package platform

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"aegisflow-api/internal/model"
	"aegisflow-api/internal/repository"
	"aegisflow-api/internal/runtime"

	"github.com/cloudwego/eino/adk"
	"github.com/cloudwego/eino/schema"
	"github.com/google/uuid"
)

type Service struct {
	repo      *repository.Repository
	runtime   *runtime.Dependencies
	uploadDir string
	indexJobs chan indexJobRequest
}

type indexJobRequest struct {
	job         model.KnowledgeIndexJob
	documentIDs []string
}

func NewService(repo *repository.Repository, rt *runtime.Dependencies, uploadDir string) *Service {
	s := &Service{
		repo:      repo,
		runtime:   rt,
		uploadDir: uploadDir,
		indexJobs: make(chan indexJobRequest, 32),
	}
	go s.indexWorker()
	return s
}

func (s *Service) CreateSession(ctx context.Context, req model.CreateSessionRequest) (model.Session, error) {
	now := time.Now()
	session := model.Session{
		ID:        "sess-" + uuid.NewString(),
		Title:     defaultString(req.Title, "AegisFlow Session"),
		Mode:      defaultString(req.Mode, "general"),
		CreatedAt: now,
		UpdatedAt: now,
	}
	return session, s.repo.CreateSession(ctx, session)
}

func (s *Service) GetRun(ctx context.Context, runID string) (*model.Run, error) {
	run, err := s.repo.GetRunV2(ctx, runID)
	if err != nil || run == nil {
		return run, err
	}
	events, err := s.repo.ListRunEvents(ctx, runID)
	if err != nil {
		return nil, err
	}
	run.Events = events
	return run, nil
}

func (s *Service) ListRunEvents(ctx context.Context, runID string) ([]model.RunEvent, error) {
	return s.repo.ListRunEvents(ctx, runID)
}

func (s *Service) UploadKnowledgeDocument(ctx context.Context, fileName, contentType, filePath string, fileSize int64) (model.KnowledgeDocument, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return model.KnowledgeDocument{}, err
	}
	now := time.Now()
	doc := model.KnowledgeDocument{
		ID:          "kdoc-" + uuid.NewString(),
		FileName:    fileName,
		Title:       strings.TrimSuffix(fileName, filepath.Ext(fileName)),
		ContentType: defaultString(contentType, "text/plain"),
		FilePath:    filePath,
		Status:      "uploaded",
		SourceType:  "upload",
		Content:     string(content),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	return doc, s.repo.CreateKnowledgeDocument(ctx, doc)
}

func (s *Service) CreateKnowledgeIndexJob(ctx context.Context, req model.CreateKnowledgeIndexJobRequest) (model.KnowledgeIndexJob, error) {
	now := time.Now()
	job := model.KnowledgeIndexJob{
		ID:             "job-" + uuid.NewString(),
		Status:         "queued",
		CollectionName: s.runtime.Config().CollectionName,
		ChunkSize:      defaultInt(req.ChunkSize, 500),
		Overlap:        defaultInt(req.Overlap, 80),
		TopK:           defaultInt(req.TopK, 4),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if len(req.DocumentIDs) == 1 {
		job.DocumentID = req.DocumentIDs[0]
	}
	if err := s.repo.CreateKnowledgeIndexJob(ctx, job); err != nil {
		return model.KnowledgeIndexJob{}, err
	}
	s.indexJobs <- indexJobRequest{
		job:         job,
		documentIDs: req.DocumentIDs,
	}
	return job, nil
}

func (s *Service) ListMCPTools(ctx context.Context) ([]model.MCPToolDescriptor, error) {
	return s.runtime.ListMCPTools(ctx)
}

func (s *Service) RunChat(ctx context.Context, req model.ChatRunRequest, onEvent func(model.RunEvent)) (model.Run, error) {
	session, err := s.repo.GetSession(ctx, req.SessionID)
	if err != nil {
		return model.Run{}, err
	}
	if session == nil {
		return model.Run{}, fmt.Errorf("session not found")
	}

	query := strings.TrimSpace(req.Query)
	if query == "" {
		return model.Run{}, fmt.Errorf("query is required")
	}

	refs, err := s.runtime.RetrieveReferences(ctx, query, defaultInt(req.TopK, 4))
	if err != nil {
		return model.Run{}, err
	}

	inputPayload, _ := json.Marshal(req)
	now := time.Now()
	run := model.Run{
		ID:           "run-" + uuid.NewString(),
		SessionID:    req.SessionID,
		RunType:      "chat",
		Status:       "running",
		InputJSON:    string(inputPayload),
		OutputJSON:   "{}",
		Summary:      "",
		CheckpointID: "cp-" + uuid.NewString(),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repo.CreateRunV2(ctx, run); err != nil {
		return model.Run{}, err
	}

	history, err := s.repo.ListSessionMessagesV2(ctx, req.SessionID, 10)
	if err != nil {
		return model.Run{}, err
	}
	messages := make([]adk.Message, 0, len(history)+1)
	for _, item := range history {
		if item.Role == "assistant" {
			messages = append(messages, schema.AssistantMessage(item.Content, nil))
			continue
		}
		messages = append(messages, schema.UserMessage(item.Content))
	}
	messages = append(messages, schema.UserMessage(query))

	runner, cleanup, err := s.runtime.NewChatRunner(ctx, refs, defaultInt(req.TopK, 4))
	if err != nil {
		return model.Run{}, err
	}
	defer cleanup()

	iter := runner.Run(ctx, messages, adk.WithCheckPointID(run.CheckpointID))
	execResult, err := s.runtime.ExecuteRun(
		ctx,
		iter,
		&run,
		func(event model.RunEvent) error { return s.repo.CreateRunEvent(ctx, event) },
		func(event model.RunEvent) {
			if onEvent != nil {
				onEvent(event)
			}
		},
		func(interrupt *model.InterruptData) {},
		run.CheckpointID,
	)
	if err != nil {
		_ = s.repo.UpdateRunV2(ctx, run.ID, map[string]any{
			"status":        "failed",
			"error_message": err.Error(),
			"completed_at":  time.Now(),
		})
		return model.Run{}, err
	}

	outputPayload, _ := json.Marshal(map[string]any{
		"references": refs,
	})
	completedAt := time.Now()
	if err := s.repo.UpdateRunV2(ctx, run.ID, map[string]any{
		"status":       "completed",
		"summary":      execResult.AssistantText,
		"output_json":  string(outputPayload),
		"completed_at": completedAt,
	}); err != nil {
		return model.Run{}, err
	}
	_ = s.repo.SaveSessionMessageV2(ctx, model.SessionMessage{
		ID:        "msg-" + uuid.NewString(),
		SessionID: req.SessionID,
		Role:      "user",
		Content:   query,
		CreatedAt: now,
	})
	if execResult.AssistantText != "" {
		_ = s.repo.SaveSessionMessageV2(ctx, model.SessionMessage{
			ID:        "msg-" + uuid.NewString(),
			SessionID: req.SessionID,
			Role:      "assistant",
			Content:   execResult.AssistantText,
			CreatedAt: time.Now(),
		})
	}
	return s.mustGetRun(ctx, run.ID)
}

func (s *Service) RunOps(ctx context.Context, req model.OpsRunRequest, onEvent func(model.RunEvent)) (model.Run, error) {
	session, err := s.repo.GetSession(ctx, req.SessionID)
	if err != nil {
		return model.Run{}, err
	}
	if session == nil {
		return model.Run{}, fmt.Errorf("session not found")
	}

	query := fmt.Sprintf("alert=%s service=%s severity=%s summary=%s", req.AlertTitle, req.ServiceName, req.Severity, req.Summary)
	refs, err := s.runtime.RetrieveReferences(ctx, query, 4)
	if err != nil {
		return model.Run{}, err
	}

	inputPayload, _ := json.Marshal(req)
	now := time.Now()
	run := model.Run{
		ID:           "run-" + uuid.NewString(),
		SessionID:    req.SessionID,
		RunType:      "ops",
		Status:       "running",
		InputJSON:    string(inputPayload),
		OutputJSON:   "{}",
		Summary:      "",
		CheckpointID: "cp-" + uuid.NewString(),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repo.CreateRunV2(ctx, run); err != nil {
		return model.Run{}, err
	}

	runner, cleanup, err := s.runtime.NewOpsRunner(ctx, req, refs)
	if err != nil {
		return model.Run{}, err
	}
	defer cleanup()

	iter := runner.Run(ctx, []adk.Message{schema.UserMessage(query)}, adk.WithCheckPointID(run.CheckpointID))
	var interrupt *model.InterruptData
	execResult, err := s.runtime.ExecuteRun(
		ctx,
		iter,
		&run,
		func(event model.RunEvent) error { return s.repo.CreateRunEvent(ctx, event) },
		func(event model.RunEvent) {
			if onEvent != nil {
				onEvent(event)
			}
		},
		func(data *model.InterruptData) { interrupt = data },
		run.CheckpointID,
	)
	if err != nil {
		_ = s.repo.UpdateRunV2(ctx, run.ID, map[string]any{
			"status":        "failed",
			"error_message": err.Error(),
			"completed_at":  time.Now(),
		})
		return model.Run{}, err
	}

	status := "completed"
	updates := map[string]any{
		"summary":      execResult.AssistantText,
		"output_json":  mustJSON(map[string]any{"references": refs}),
		"completed_at": time.Now(),
	}
	if interrupt != nil {
		status = "interrupted"
		updates["interrupt_json"] = mustJSON(interrupt)
	} else {
		updates["interrupt_json"] = ""
	}
	updates["status"] = status
	if err := s.repo.UpdateRunV2(ctx, run.ID, updates); err != nil {
		return model.Run{}, err
	}
	return s.mustGetRun(ctx, run.ID)
}

func (s *Service) ResumeRun(ctx context.Context, runID string, req model.ResumeRunRequest, onEvent func(model.RunEvent)) (model.Run, error) {
	run, err := s.repo.GetRunV2(ctx, runID)
	if err != nil {
		return model.Run{}, err
	}
	if run == nil {
		return model.Run{}, fmt.Errorf("run not found")
	}
	if run.Status != "interrupted" {
		return model.Run{}, fmt.Errorf("run is not interrupted")
	}
	if run.CheckpointID == "" {
		return model.Run{}, fmt.Errorf("checkpoint not found")
	}

	var input model.OpsRunRequest
	if err := json.Unmarshal([]byte(run.InputJSON), &input); err != nil {
		return model.Run{}, err
	}
	refs, err := s.runtime.RetrieveReferences(ctx, fmt.Sprintf("alert=%s service=%s summary=%s", input.AlertTitle, input.ServiceName, input.Summary), 4)
	if err != nil {
		return model.Run{}, err
	}

	runner, cleanup, err := s.runtime.NewOpsRunner(ctx, input, refs)
	if err != nil {
		return model.Run{}, err
	}
	defer cleanup()

	target := req.InterruptID
	if target == "" && run.Interrupt != nil && len(run.Interrupt.Contexts) > 0 {
		target = run.Interrupt.Contexts[0].ID
	}
	if target == "" {
		return model.Run{}, fmt.Errorf("interrupt target not found")
	}

	iter, err := runner.ResumeWithParams(ctx, run.CheckpointID, &adk.ResumeParams{
		Targets: map[string]any{
			target: &runtime.ApprovalResumeData{
				Approved: req.Approved,
				Note:     req.Note,
			},
		},
	})
	if err != nil {
		return model.Run{}, err
	}

	var interrupt *model.InterruptData
	execResult, err := s.runtime.ExecuteRun(
		ctx,
		iter,
		run,
		func(event model.RunEvent) error { return s.repo.CreateRunEvent(ctx, event) },
		func(event model.RunEvent) {
			if onEvent != nil {
				onEvent(event)
			}
		},
		func(data *model.InterruptData) { interrupt = data },
		run.CheckpointID,
	)
	if err != nil {
		_ = s.repo.UpdateRunV2(ctx, run.ID, map[string]any{
			"status":        "failed",
			"error_message": err.Error(),
			"completed_at":  time.Now(),
		})
		return model.Run{}, err
	}

	status := "completed"
	update := map[string]any{
		"summary":      execResult.AssistantText,
		"completed_at": time.Now(),
	}
	if interrupt != nil {
		status = "interrupted"
		update["interrupt_json"] = mustJSON(interrupt)
	} else {
		update["interrupt_json"] = ""
	}
	update["status"] = status
	if err := s.repo.UpdateRunV2(ctx, run.ID, update); err != nil {
		return model.Run{}, err
	}
	return s.mustGetRun(ctx, run.ID)
}

func (s *Service) indexWorker() {
	for jobReq := range s.indexJobs {
		ctx := context.Background()
		_ = s.repo.UpdateKnowledgeIndexJob(ctx, jobReq.job.ID, map[string]any{
			"status": "running",
		})
		docs, err := s.repo.ListKnowledgeDocuments(ctx, jobReq.documentIDs)
		if err != nil {
			_ = s.repo.UpdateKnowledgeIndexJob(ctx, jobReq.job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			})
			continue
		}
		indexer, closeFn, err := s.runtime.NewIndexer(ctx)
		if err != nil {
			_ = s.repo.UpdateKnowledgeIndexJob(ctx, jobReq.job.ID, map[string]any{
				"status":        "failed",
				"error_message": err.Error(),
			})
			continue
		}
		func() {
			defer closeFn()
			totalChunks := 0
			for _, doc := range docs {
				chunks := runtime.BuildChunkDocuments(doc, jobReq.job.ChunkSize, jobReq.job.Overlap)
				totalChunks += len(chunks)
				if len(chunks) == 0 {
					continue
				}
				if _, err := indexer.Store(ctx, chunks); err != nil {
					_ = s.repo.UpdateKnowledgeIndexJob(ctx, jobReq.job.ID, map[string]any{
						"status":        "failed",
						"error_message": err.Error(),
					})
					return
				}
				_ = s.repo.UpdateKnowledgeDocument(ctx, doc.ID, map[string]any{
					"status": "indexed",
				})
			}
			_ = s.repo.UpdateKnowledgeIndexJob(ctx, jobReq.job.ID, map[string]any{
				"status":         "completed",
				"indexed_chunks": totalChunks,
				"completed_at":   time.Now(),
			})
		}()
	}
}

func (s *Service) mustGetRun(ctx context.Context, runID string) (model.Run, error) {
	run, err := s.GetRun(ctx, runID)
	if err != nil {
		return model.Run{}, err
	}
	if run == nil {
		return model.Run{}, fmt.Errorf("run not found after execution")
	}
	return *run, nil
}

func defaultInt(value int, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func mustJSON(value any) string {
	bytes, _ := json.Marshal(value)
	return string(bytes)
}
