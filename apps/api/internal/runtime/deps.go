package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"aegisflow-api/internal/model"
	"aegisflow-api/internal/repository"

	embedopenai "github.com/cloudwego/eino-ext/components/embedding/openai"
	milvusindexer "github.com/cloudwego/eino-ext/components/indexer/milvus"
	modelopenai "github.com/cloudwego/eino-ext/components/model/openai"
	milvusretriever "github.com/cloudwego/eino-ext/components/retriever/milvus"
	extmcp "github.com/cloudwego/eino-ext/components/tool/mcp"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
	mcpclient "github.com/mark3labs/mcp-go/client"
	mcpproto "github.com/mark3labs/mcp-go/mcp"
	milvusclient "github.com/milvus-io/milvus-sdk-go/v2/client"
)

type Dependencies struct {
	cfg         Config
	repo        *repository.Repository
	checkpoints *CheckpointStore
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

func (d *Dependencies) NewEmbedder(ctx context.Context) (*embedopenai.Embedder, error) {
	if !d.cfg.HasModelAccess() {
		return nil, fmt.Errorf("AEGISFLOW_OPENAI_API_KEY is required")
	}
	return embedopenai.NewEmbedder(ctx, &embedopenai.EmbeddingConfig{
		BaseURL: d.cfg.OpenAIBaseURL,
		APIKey:  d.cfg.OpenAIAPIKey,
		Model:   d.cfg.EmbeddingModel,
		Timeout: 60 * time.Second,
	})
}

func (d *Dependencies) NewMilvusClient(ctx context.Context) (milvusclient.Client, error) {
	return milvusclient.NewClient(ctx, milvusclient.Config{
		Address:  d.cfg.MilvusAddr,
		Username: d.cfg.MilvusUsername,
		Password: d.cfg.MilvusPassword,
	})
}

func (d *Dependencies) NewIndexer(ctx context.Context) (*milvusindexer.Indexer, func() error, error) {
	cli, err := d.NewMilvusClient(ctx)
	if err != nil {
		return nil, nil, err
	}
	embedder, err := d.NewEmbedder(ctx)
	if err != nil {
		_ = cli.Close()
		return nil, nil, err
	}
	indexer, err := milvusindexer.NewIndexer(ctx, &milvusindexer.IndexerConfig{
		Client:     cli,
		Collection: d.cfg.CollectionName,
		Embedding:  embedder,
	})
	if err != nil {
		_ = cli.Close()
		return nil, nil, err
	}
	return indexer, cli.Close, nil
}

func (d *Dependencies) NewRetriever(ctx context.Context, topK int) (*milvusretriever.Retriever, func() error, error) {
	cli, err := d.NewMilvusClient(ctx)
	if err != nil {
		return nil, nil, err
	}
	embedder, err := d.NewEmbedder(ctx)
	if err != nil {
		_ = cli.Close()
		return nil, nil, err
	}
	retriever, err := milvusretriever.NewRetriever(ctx, &milvusretriever.RetrieverConfig{
		Client:      cli,
		Collection:  d.cfg.CollectionName,
		VectorField: "vector",
		OutputFields: []string{
			"id",
			"content",
			"metadata",
		},
		TopK:      topK,
		Embedding: embedder,
	})
	if err != nil {
		_ = cli.Close()
		return nil, nil, err
	}
	return retriever, cli.Close, nil
}

func (d *Dependencies) RetrieveReferences(ctx context.Context, query string, topK int) ([]model.ReferenceChunk, error) {
	retriever, closeFn, err := d.NewRetriever(ctx, topK)
	if err != nil {
		return nil, err
	}
	defer closeFn()

	docs, err := retriever.Retrieve(ctx, query)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "no results found") {
			return []model.ReferenceChunk{}, nil
		}
		return nil, err
	}

	refs := make([]model.ReferenceChunk, 0, len(docs))
	for _, doc := range docs {
		score := 0.0
		if value, ok := doc.MetaData["_score"]; ok {
			switch typed := value.(type) {
			case float64:
				score = typed
			case float32:
				score = float64(typed)
			}
		}
		refs = append(refs, model.ReferenceChunk{
			DocumentID: doc.ID,
			Title:      stringValue(doc.MetaData["title"], doc.ID),
			Content:    doc.Content,
			Score:      score,
			MetaData:   doc.MetaData,
		})
	}
	return refs, nil
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
