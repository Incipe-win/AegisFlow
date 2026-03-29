package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync/atomic"
	"time"
	"unicode"
	"unicode/utf8"

	"aegisflow-api/internal/model"
	"aegisflow-api/internal/repository"

	"github.com/cloudwego/eino/components/embedding"
	embedopenai "github.com/cloudwego/eino-ext/components/embedding/openai"
	modelopenai "github.com/cloudwego/eino-ext/components/model/openai"
	extmcp "github.com/cloudwego/eino-ext/components/tool/mcp"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
	mcpclient "github.com/mark3labs/mcp-go/client"
	mcpproto "github.com/mark3labs/mcp-go/mcp"
	milvusclient "github.com/milvus-io/milvus-sdk-go/v2/client"
)

const referenceRetrievalTimeout = 3 * time.Second

type Dependencies struct {
	cfg         Config
	repo        *repository.Repository
	checkpoints *CheckpointStore
}

type adaptiveEmbedder struct {
	standard         embedding.Embedder
	multimodal       embedding.Embedder
	preferMultimodal atomic.Bool
}

func NewDependencies(cfg Config, repo *repository.Repository) *Dependencies {
	return &Dependencies{
		cfg:         cfg,
		repo:        repo,
		checkpoints: NewCheckpointStore(repo),
	}
}

func (d *Dependencies) Config() Config {
	return d.cfg
}

func (d *Dependencies) CheckpointStore() *CheckpointStore {
	return d.checkpoints
}

func (d *Dependencies) NewChatModel(ctx context.Context) (*modelopenai.ChatModel, error) {
	if !d.cfg.HasModelAccess() {
		return nil, fmt.Errorf("AEGISFLOW_OPENAI_API_KEY is required")
	}
	return modelopenai.NewChatModel(ctx, &modelopenai.ChatModelConfig{
		BaseURL: d.cfg.OpenAIBaseURL,
		APIKey:  d.cfg.OpenAIAPIKey,
		Model:   d.cfg.ChatModel,
		Timeout: 60 * time.Second,
	})
}

func (d *Dependencies) NewEmbedder(ctx context.Context) (embedding.Embedder, error) {
	if !d.cfg.HasModelAccess() {
		return nil, fmt.Errorf("AEGISFLOW_OPENAI_API_KEY is required")
	}
	standard, err := embedopenai.NewEmbedder(ctx, &embedopenai.EmbeddingConfig{
		BaseURL: d.cfg.OpenAIBaseURL,
		APIKey:  d.cfg.OpenAIAPIKey,
		Model:   d.cfg.EmbeddingModel,
		Timeout: 60 * time.Second,
	})
	if err != nil {
		return nil, err
	}

	multimodal, err := newArkMultimodalEmbedder(&arkMultimodalEmbedderConfig{
		BaseURL: d.cfg.OpenAIBaseURL,
		APIKey:  d.cfg.OpenAIAPIKey,
		Model:   d.cfg.EmbeddingModel,
		Timeout: 60 * time.Second,
	})
	if err != nil {
		return standard, nil
	}

	return &adaptiveEmbedder{
		standard:   standard,
		multimodal: multimodal,
	}, nil
}

func (e *adaptiveEmbedder) EmbedStrings(ctx context.Context, texts []string, opts ...embedding.Option) ([][]float64, error) {
	if e.multimodal != nil && e.preferMultimodal.Load() {
		return e.multimodal.EmbedStrings(ctx, texts, opts...)
	}

	embeddings, err := e.standard.EmbedStrings(ctx, texts, opts...)
	if err == nil || e.multimodal == nil || !shouldFallbackToArkMultimodal(err) {
		return embeddings, err
	}

	e.preferMultimodal.Store(true)
	multimodalEmbeddings, multimodalErr := e.multimodal.EmbedStrings(ctx, texts, opts...)
	if multimodalErr != nil {
		return nil, fmt.Errorf("%w; multimodal fallback failed: %v", err, multimodalErr)
	}
	return multimodalEmbeddings, nil
}

func shouldFallbackToArkMultimodal(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	for _, marker := range []string{
		"invalidendpointormodel",
		"does not support this api",
		"does not exist or you do not have access to it",
		"requested model",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

func (d *Dependencies) NewMilvusClient(ctx context.Context) (milvusclient.Client, error) {
	return milvusclient.NewClient(ctx, milvusclient.Config{
		Address:  d.cfg.MilvusAddr,
		Username: d.cfg.MilvusUsername,
		Password: d.cfg.MilvusPassword,
	})
}

func (d *Dependencies) NewIndexer(ctx context.Context) (*MilvusKnowledgeIndexer, func() error, error) {
	cli, err := d.NewMilvusClient(ctx)
	if err != nil {
		return nil, nil, err
	}
	embedder, err := d.NewEmbedder(ctx)
	if err != nil {
		_ = cli.Close()
		return nil, nil, err
	}
	return &MilvusKnowledgeIndexer{
		client:     cli,
		collection: d.cfg.CollectionName,
		embedder:   embedder,
	}, cli.Close, nil
}

func (d *Dependencies) RetrieveReferences(ctx context.Context, query string, topK int) ([]model.ReferenceChunk, error) {
	retrieveCtx, cancel := context.WithTimeout(ctx, referenceRetrievalTimeout)
	defer cancel()

	cli, err := d.NewMilvusClient(retrieveCtx)
	if err != nil {
		if shouldFallbackReferenceRetrieval(err) {
			return d.retrieveLocalReferences(ctx, query, topK)
		}
		return nil, err
	}
	defer cli.Close()

	embedder, err := d.NewEmbedder(retrieveCtx)
	if err != nil {
		if shouldFallbackReferenceRetrieval(err) {
			return d.retrieveLocalReferences(ctx, query, topK)
		}
		return nil, err
	}

	refs, err := retrieveMilvusReferences(retrieveCtx, cli, d.cfg.CollectionName, embedder, query, topK)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "no results found") {
			return d.retrieveLocalReferences(ctx, query, topK)
		}
		if shouldFallbackReferenceRetrieval(err) {
			return d.retrieveLocalReferences(ctx, query, topK)
		}
		return nil, err
	}
	if len(refs) == 0 {
		return d.retrieveLocalReferences(ctx, query, topK)
	}
	return refs, nil
}

func (d *Dependencies) retrieveLocalReferences(ctx context.Context, query string, topK int) ([]model.ReferenceChunk, error) {
	docs, err := d.repo.ListKnowledgeDocuments(ctx, nil)
	if err != nil {
		return nil, err
	}

	normalizedQuery := normalizeSearchText(query)
	if normalizedQuery == "" {
		return []model.ReferenceChunk{}, nil
	}
	tokens := buildSearchTokens(normalizedQuery)
	if len(tokens) == 0 {
		return []model.ReferenceChunk{}, nil
	}

	type candidate struct {
		ref   model.ReferenceChunk
		score float64
	}

	candidates := make([]candidate, 0, len(docs))
	for _, doc := range docs {
		title := strings.TrimSpace(doc.Title)
		content := strings.TrimSpace(doc.Content)
		if title == "" || content == "" {
			continue
		}

		titleText := normalizeSearchText(title)
		for idx, chunk := range splitIntoChunks(content, 500, 80) {
			score := scoreLocalReferenceChunk(normalizedQuery, tokens, titleText, normalizeSearchText(chunk))
			if score <= 0 {
				continue
			}
			candidates = append(candidates, candidate{
				ref: model.ReferenceChunk{
					DocumentID: doc.ID,
					Title:      title,
					Content:    strings.TrimSpace(chunk),
					Score:      score,
					MetaData: map[string]any{
						"source":     "local-fallback",
						"chunkIndex": idx,
					},
				},
				score: score,
			})
		}
	}

	if len(candidates) == 0 {
		return []model.ReferenceChunk{}, nil
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})

	limit := topK
	if limit <= 0 {
		limit = 4
	}

	refs := make([]model.ReferenceChunk, 0, limit)
	seen := map[string]struct{}{}
	for _, candidate := range candidates {
		key := candidate.ref.DocumentID + ":" + candidate.ref.Content
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		refs = append(refs, candidate.ref)
		if len(refs) == limit {
			break
		}
	}
	return refs, nil
}

func scoreLocalReferenceChunk(query string, tokens []string, title string, chunk string) float64 {
	score := 0.0
	if query != "" {
		if strings.Contains(title, query) {
			score += 10
		}
		if strings.Contains(chunk, query) {
			score += 8
		}
	}

	for _, token := range tokens {
		if token == "" {
			continue
		}
		if strings.Contains(title, token) {
			score += 4
		}
		if count := strings.Count(chunk, token); count > 0 {
			score += float64(count) * tokenWeight(token)
		}
	}
	return score
}

func tokenWeight(token string) float64 {
	switch n := utf8.RuneCountInString(token); {
	case n >= 8:
		return 3
	case n >= 4:
		return 2
	default:
		return 1
	}
}

func buildSearchTokens(query string) []string {
	seen := map[string]struct{}{}
	add := func(value string) {
		value = normalizeSearchText(value)
		if utf8.RuneCountInString(value) < 2 {
			return
		}
		seen[value] = struct{}{}
	}

	add(query)
	for _, part := range strings.FieldsFunc(query, func(r rune) bool {
		return unicode.IsSpace(r) || unicode.IsPunct(r) || unicode.IsSymbol(r)
	}) {
		add(part)
	}

	tokens := make([]string, 0, len(seen))
	for token := range seen {
		tokens = append(tokens, token)
	}
	sort.Slice(tokens, func(i, j int) bool {
		return utf8.RuneCountInString(tokens[i]) > utf8.RuneCountInString(tokens[j])
	})
	return tokens
}

func normalizeSearchText(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}
	return strings.Join(strings.Fields(value), " ")
}

func shouldFallbackReferenceRetrieval(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}

	message := strings.ToLower(err.Error())
	for _, marker := range []string{
		"connection refused",
		"deadline exceeded",
		"timed out",
		"unavailable",
		"failed to connect",
		"error while dialing",
		"no available",
		"transport is closing",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

func (d *Dependencies) NewMCPClient(ctx context.Context) (*mcpclient.Client, error) {
	cli, err := mcpclient.NewSSEMCPClient(d.cfg.MCPSSEURL)
	if err != nil {
		return nil, err
	}
	if err := cli.Start(ctx); err != nil {
		return nil, err
	}
	_, err = cli.Initialize(ctx, mcpproto.InitializeRequest{
		Params: mcpproto.InitializeParams{
			ProtocolVersion: mcpproto.LATEST_PROTOCOL_VERSION,
			ClientInfo: mcpproto.Implementation{
				Name:    "aegisflow-api",
				Version: "1.0.0",
			},
		},
	})
	if err != nil {
		_ = cli.Close()
		return nil, err
	}
	return cli, nil
}

func (d *Dependencies) ListMCPTools(ctx context.Context) ([]model.MCPToolDescriptor, error) {
	cli, err := d.NewMCPClient(ctx)
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	result, err := cli.ListTools(ctx, mcpproto.ListToolsRequest{})
	if err != nil {
		return nil, err
	}

	tools := make([]model.MCPToolDescriptor, 0, len(result.Tools))
	for _, item := range result.Tools {
		schemaJSON, _ := json.Marshal(item.InputSchema)
		tools = append(tools, model.MCPToolDescriptor{
			Name:        item.Name,
			Description: item.Description,
			SchemaJSON:  string(schemaJSON),
		})
	}
	return tools, nil
}

func (d *Dependencies) NewMCPTools(ctx context.Context, names []string) ([]tool.BaseTool, func() error, error) {
	cli, err := d.NewMCPClient(ctx)
	if err != nil {
		return nil, nil, err
	}
	tools, err := extmcp.GetTools(ctx, &extmcp.Config{
		Cli:          cli,
		ToolNameList: names,
	})
	if err != nil {
		_ = cli.Close()
		return nil, nil, err
	}
	return tools, cli.Close, nil
}

func BuildChunkDocuments(doc model.KnowledgeDocument, chunkSize int, overlap int) []*schema.Document {
	chunks := splitIntoChunks(doc.Content, chunkSize, overlap)
	out := make([]*schema.Document, 0, len(chunks))
	for idx, chunk := range chunks {
		out = append(out, &schema.Document{
			ID:      fmt.Sprintf("%s#%d", doc.ID, idx),
			Content: chunk,
			MetaData: map[string]any{
				"documentId": doc.ID,
				"title":      doc.Title,
				"chunkIndex": idx,
			},
		})
	}
	return out
}

func splitIntoChunks(text string, chunkSize int, overlap int) []string {
	if chunkSize <= 0 {
		chunkSize = 500
	}
	if overlap < 0 || overlap >= chunkSize {
		overlap = 50
	}
	runes := []rune(strings.TrimSpace(text))
	if len(runes) == 0 {
		return []string{}
	}
	if len(runes) <= chunkSize {
		return []string{string(runes)}
	}
	step := chunkSize - overlap
	if step <= 0 {
		step = chunkSize
	}
	parts := make([]string, 0)
	for start := 0; start < len(runes); start += step {
		end := start + chunkSize
		if end > len(runes) {
			end = len(runes)
		}
		part := strings.TrimSpace(string(runes[start:end]))
		if part != "" {
			parts = append(parts, part)
		}
		if end == len(runes) {
			break
		}
	}
	return parts
}

func stringValue(value any, fallback string) string {
	switch typed := value.(type) {
	case string:
		if typed != "" {
			return typed
		}
	}
	return fallback
}
