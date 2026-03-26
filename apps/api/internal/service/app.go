package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"aegisflow-api/internal/agent"
	"aegisflow-api/internal/model"
	"aegisflow-api/internal/repository"
	"aegisflow-api/internal/tool"

	"github.com/google/uuid"
)

const (
	defaultChunkSize = 220
	defaultOverlap   = 40
	defaultTopK      = 3
)

type App struct {
	repo      *repository.Repository
	retriever *agent.Retriever
	chatAgent *agent.ChatAgent
	opsAgent  *agent.OpsAgent
	tooling   tool.Provider
	uploadDir string
}

func NewApp(
	repo *repository.Repository,
	retriever *agent.Retriever,
	chatAgent *agent.ChatAgent,
	opsAgent *agent.OpsAgent,
	tooling tool.Provider,
	uploadDir string,
) *App {
	return &App{
		repo:      repo,
		retriever: retriever,
		chatAgent: chatAgent,
		opsAgent:  opsAgent,
		tooling:   tooling,
		uploadDir: uploadDir,
	}
}

func (a *App) UploadDocument(ctx context.Context, fileName string, filePath string, fileSize int64) (model.UploadFileResponseData, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return model.UploadFileResponseData{}, err
	}
	now := time.Now()
	record := model.DocumentRecord{
		ID:         "doc-" + uuid.NewString(),
		Title:      strings.TrimSuffix(fileName, filepath.Ext(fileName)),
		SourceType: "upload",
		FilePath:   filePath,
		FileSize:   fileSize,
		Status:     "uploaded",
		Content:    string(content),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := a.repo.SaveDocument(ctx, record); err != nil {
		return model.UploadFileResponseData{}, err
	}
	return model.UploadFileResponseData{
		DocumentID: record.ID,
		FileName:   fileName,
		FilePath:   filePath,
		FileSize:   fileSize,
		Status:     record.Status,
	}, nil
}

func (a *App) IndexKnowledge(ctx context.Context, req model.KnowledgeIndexRequest) (model.KnowledgeIndexResponseData, error) {
	chunkSize := req.ChunkSize
	if chunkSize <= 0 {
		chunkSize = defaultChunkSize
	}
	overlap := req.Overlap
	if overlap < 0 || overlap >= chunkSize {
		overlap = defaultOverlap
	}
	topK := req.TopK
	if topK <= 0 {
		topK = defaultTopK
	}

	docs, err := a.repo.ListDocumentsForIndex(ctx, req.DocumentIDs)
	if err != nil {
		return model.KnowledgeIndexResponseData{}, err
	}
	ids := make([]string, 0, len(docs))
	for _, doc := range docs {
		ids = append(ids, doc.ID)
	}
	if err := a.repo.DeleteChunksForDocuments(ctx, ids); err != nil {
		return model.KnowledgeIndexResponseData{}, err
	}

	totalChunks := 0
	now := time.Now()
	for _, doc := range docs {
		chunks := splitIntoChunks(doc.Content, chunkSize, overlap)
		for idx, chunkText := range chunks {
			chunk := model.DocumentChunkRecord{
				ID:         "chunk-" + uuid.NewString(),
				DocumentID: doc.ID,
				Position:   idx,
				Content:    chunkText,
				CreatedAt:  now,
			}
			if err := a.repo.InsertChunk(ctx, chunk); err != nil {
				return model.KnowledgeIndexResponseData{}, err
			}
			totalChunks++
		}
		if err := a.repo.TouchDocumentIndexed(ctx, doc.ID, now); err != nil {
			return model.KnowledgeIndexResponseData{}, err
		}
	}

	return model.KnowledgeIndexResponseData{
		IndexedDocuments: len(docs),
		IndexedChunks:    totalChunks,
		ChunkSize:        chunkSize,
		Overlap:          overlap,
		TopK:             topK,
	}, nil
}

func (a *App) Chat(ctx context.Context, req model.ChatRequest) (model.ChatResponseData, string, []string, error) {
	if req.TopK <= 0 {
		req.TopK = defaultTopK
	}
	history, err := a.repo.ListChatMessages(ctx, req.SessionID, 8)
	if err != nil {
		return model.ChatResponseData{}, "", nil, err
	}
	references, err := a.retriever.Search(ctx, req.Question, req.TopK)
	if err != nil {
		return model.ChatResponseData{}, "", nil, err
	}
	answer, suggestions, detail := a.chatAgent.Respond(req.Question, history, references)
	now := time.Now()

	if err := a.repo.SaveChatMessage(ctx, model.ChatMessageRecord{
		ID:        "msg-" + uuid.NewString(),
		SessionID: req.SessionID,
		Role:      "user",
		Content:   req.Question,
		CreatedAt: now,
	}); err != nil {
		return model.ChatResponseData{}, "", nil, err
	}
	if err := a.repo.SaveChatMessage(ctx, model.ChatMessageRecord{
		ID:        "msg-" + uuid.NewString(),
		SessionID: req.SessionID,
		Role:      "assistant",
		Content:   answer,
		CreatedAt: now.Add(time.Millisecond),
	}); err != nil {
		return model.ChatResponseData{}, "", nil, err
	}

	runID, err := a.saveRun(ctx, "chat", "completed", answer, detail, references, nil)
	if err != nil {
		return model.ChatResponseData{}, "", nil, err
	}

	return model.ChatResponseData{
		SessionID:   req.SessionID,
		Answer:      answer,
		References:  references,
		Suggestions: suggestions,
	}, runID, detail, nil
}

func (a *App) Diagnose(ctx context.Context, req model.DiagnoseRequest) (model.DiagnoseResponseData, error) {
	references, err := a.retriever.Search(ctx, req.AlertTitle+" "+req.ServiceName+" "+req.Summary, defaultTopK)
	if err != nil {
		return model.DiagnoseResponseData{}, err
	}
	toolCalls, err := a.tooling.Diagnose(ctx, req)
	if err != nil {
		return model.DiagnoseResponseData{}, err
	}
	result, detail := a.opsAgent.Diagnose(req, references, toolCalls)
	runID, err := a.saveRun(ctx, "ops", "completed", result, detail, references, toolCalls)
	if err != nil {
		return model.DiagnoseResponseData{}, err
	}

	return model.DiagnoseResponseData{
		RunID:      runID,
		Result:     result,
		Detail:     detail,
		References: references,
		ToolCalls:  toolCalls,
	}, nil
}

func (a *App) GetRunDetail(ctx context.Context, runID string) (*model.RunDetailData, error) {
	run, err := a.repo.GetRun(ctx, runID)
	if err != nil {
		return nil, err
	}
	if run == nil {
		return nil, nil
	}
	var detail []string
	var refs []model.Reference
	var toolCalls []model.ToolCallRecord
	if err := json.Unmarshal([]byte(run.DetailJSON), &detail); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(run.ReferencesJSON), &refs); err != nil {
		return nil, err
	}
	if run.ToolCallsJSON != "" {
		if err := json.Unmarshal([]byte(run.ToolCallsJSON), &toolCalls); err != nil {
			return nil, err
		}
	}
	return &model.RunDetailData{
		RunID:      run.ID,
		RunType:    run.RunType,
		Status:     run.Status,
		Summary:    run.Summary,
		Detail:     detail,
		References: refs,
		ToolCalls:  toolCalls,
		CreatedAt:  run.CreatedAt,
	}, nil
}

func (a *App) saveRun(
	ctx context.Context,
	runType string,
	status string,
	summary string,
	detail []string,
	references []model.Reference,
	toolCalls []model.ToolCallRecord,
) (string, error) {
	detailJSON, err := json.Marshal(detail)
	if err != nil {
		return "", err
	}
	referencesJSON, err := json.Marshal(references)
	if err != nil {
		return "", err
	}
	toolCallsJSON, err := json.Marshal(toolCalls)
	if err != nil {
		return "", err
	}
	runID := "run-" + uuid.NewString()
	err = a.repo.SaveRun(ctx, model.RunRecord{
		ID:             runID,
		RunType:        runType,
		Status:         status,
		Summary:        summary,
		DetailJSON:     string(detailJSON),
		ReferencesJSON: string(referencesJSON),
		ToolCallsJSON:  string(toolCallsJSON),
		CreatedAt:      time.Now(),
	})
	return runID, err
}

func splitIntoChunks(text string, chunkSize int, overlap int) []string {
	normalized := strings.TrimSpace(text)
	if normalized == "" {
		return []string{}
	}
	runes := []rune(normalized)
	if len(runes) <= chunkSize {
		return []string{normalized}
	}

	step := chunkSize - overlap
	if step <= 0 {
		step = chunkSize
	}
	chunks := make([]string, 0)
	for start := 0; start < len(runes); start += step {
		end := start + chunkSize
		if end > len(runes) {
			end = len(runes)
		}
		chunk := strings.TrimSpace(string(runes[start:end]))
		if chunk != "" {
			chunks = append(chunks, chunk)
		}
		if end == len(runes) {
			break
		}
	}
	return chunks
}

func SplitForStream(text string, chunkSize int) []string {
	if chunkSize <= 0 {
		chunkSize = 24
	}
	runes := []rune(strings.TrimSpace(text))
	if len(runes) == 0 {
		return []string{}
	}
	parts := make([]string, 0, (len(runes)/chunkSize)+1)
	for start := 0; start < len(runes); start += chunkSize {
		end := start + chunkSize
		if end > len(runes) {
			end = len(runes)
		}
		parts = append(parts, string(runes[start:end]))
	}
	return parts
}

func BuildReferenceEvent(ref model.Reference) string {
	return fmt.Sprintf(`{"title":%q,"score":%.2f}`, ref.Title, ref.Score)
}
