package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"aegisflow-api/internal/model"
)

func (r *Repository) CreateSession(ctx context.Context, session model.Session) error {
	_, err := r.db.Model("agent_sessions").Data(map[string]any{
		"id":         session.ID,
		"title":      session.Title,
		"mode":       session.Mode,
		"created_at": session.CreatedAt,
		"updated_at": session.UpdatedAt,
	}).Insert()
	return err
}

func (r *Repository) GetSession(ctx context.Context, id string) (*model.Session, error) {
	var session model.Session
	err := r.db.Model("agent_sessions").Where("id", id).Scan(&session)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if session.ID == "" {
		return nil, nil
	}
	return &session, nil
}

func (r *Repository) SaveSessionMessageV2(ctx context.Context, msg model.SessionMessage) error {
	_, err := r.db.Model("agent_session_messages").Data(map[string]any{
		"id":         msg.ID,
		"session_id": msg.SessionID,
		"role":       msg.Role,
		"content":    msg.Content,
		"created_at": msg.CreatedAt,
	}).Insert()
	return err
}

func (r *Repository) ListSessionMessagesV2(ctx context.Context, sessionID string, limit int) ([]model.SessionMessage, error) {
	var messages []model.SessionMessage
	query := r.db.Model("agent_session_messages").Where("session_id", sessionID).OrderAsc("created_at")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Scan(&messages)
	return messages, err
}

func (r *Repository) CreateRunV2(ctx context.Context, run model.Run) error {
	_, err := r.db.Model("agent_runs_v2").Data(map[string]any{
		"id":             run.ID,
		"session_id":     run.SessionID,
		"run_type":       run.RunType,
		"status":         run.Status,
		"input_json":     run.InputJSON,
		"output_json":    run.OutputJSON,
		"summary":        run.Summary,
		"error_message":  run.ErrorMessage,
		"checkpoint_id":  run.CheckpointID,
		"interrupt_json": run.InterruptJSON,
		"created_at":     run.CreatedAt,
		"updated_at":     run.UpdatedAt,
		"completed_at":   run.CompletedAt,
	}).Insert()
	return err
}

func (r *Repository) UpdateRunV2(ctx context.Context, runID string, data map[string]any) error {
	data["updated_at"] = time.Now()
	_, err := r.db.Model("agent_runs_v2").Data(data).Where("id", runID).Update()
	return err
}

func (r *Repository) GetRunV2(ctx context.Context, runID string) (*model.Run, error) {
	var run model.Run
	err := r.db.Model("agent_runs_v2").Where("id", runID).Scan(&run)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if run.ID == "" {
		return nil, nil
	}
	if run.InterruptJSON != "" {
		var interrupt model.InterruptData
		if err := json.Unmarshal([]byte(run.InterruptJSON), &interrupt); err == nil {
			run.Interrupt = &interrupt
		}
	}
	return &run, nil
}

func (r *Repository) CreateRunEvent(ctx context.Context, event model.RunEvent) error {
	_, err := r.db.Model("agent_run_events").Data(map[string]any{
		"id":           event.ID,
		"run_id":       event.RunID,
		"sequence_no":  event.Sequence,
		"event_type":   event.EventType,
		"agent_name":   event.AgentName,
		"role":         event.Role,
		"tool_name":    event.ToolName,
		"content":      event.Content,
		"payload_json": event.PayloadJSON,
		"created_at":   event.CreatedAt,
	}).Insert()
	return err
}

func (r *Repository) ListRunEvents(ctx context.Context, runID string) ([]model.RunEvent, error) {
	var events []model.RunEvent
	err := r.db.Model("agent_run_events").Where("run_id", runID).OrderAsc("sequence_no").Scan(&events)
	if err != nil {
		return nil, err
	}
	for i := range events {
		if events[i].PayloadJSON != "" {
			var payload any
			if err := json.Unmarshal([]byte(events[i].PayloadJSON), &payload); err == nil {
				events[i].Payload = payload
			}
		}
	}
	return events, nil
}

func (r *Repository) CreateKnowledgeDocument(ctx context.Context, doc model.KnowledgeDocument) error {
	_, err := r.db.Model("knowledge_documents").Data(map[string]any{
		"id":           doc.ID,
		"file_name":    doc.FileName,
		"title":        doc.Title,
		"content_type": doc.ContentType,
		"file_path":    doc.FilePath,
		"status":       doc.Status,
		"source_type":  doc.SourceType,
		"content":      doc.Content,
		"created_at":   doc.CreatedAt,
		"updated_at":   doc.UpdatedAt,
	}).Insert()
	return err
}

func (r *Repository) UpdateKnowledgeDocument(ctx context.Context, docID string, data map[string]any) error {
	data["updated_at"] = time.Now()
	_, err := r.db.Model("knowledge_documents").Data(data).Where("id", docID).Update()
	return err
}

func (r *Repository) GetKnowledgeDocument(ctx context.Context, docID string) (*model.KnowledgeDocument, error) {
	var doc model.KnowledgeDocument
	err := r.db.Model("knowledge_documents").Where("id", docID).Scan(&doc)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if doc.ID == "" {
		return nil, nil
	}
	return &doc, nil
}

func (r *Repository) ListKnowledgeDocuments(ctx context.Context, ids []string) ([]model.KnowledgeDocument, error) {
	var docs []model.KnowledgeDocument
	query := r.db.Model("knowledge_documents").OrderAsc("created_at")
	if len(ids) > 0 {
		query = query.WhereIn("id", ids)
	}
	err := query.Scan(&docs)
	return docs, err
}

func (r *Repository) CountKnowledgeDocuments(ctx context.Context) (int, error) {
	return r.db.Model("knowledge_documents").Count()
}

func (r *Repository) CreateKnowledgeIndexJob(ctx context.Context, job model.KnowledgeIndexJob) error {
	_, err := r.db.Model("knowledge_index_jobs").Data(map[string]any{
		"id":              job.ID,
		"document_id":     job.DocumentID,
		"status":          job.Status,
		"collection_name": job.CollectionName,
		"chunk_size":      job.ChunkSize,
		"overlap":         job.Overlap,
		"top_k":           job.TopK,
		"indexed_chunks":  job.IndexedChunks,
		"error_message":   job.ErrorMessage,
		"created_at":      job.CreatedAt,
		"updated_at":      job.UpdatedAt,
		"completed_at":    job.CompletedAt,
	}).Insert()
	return err
}

func (r *Repository) UpdateKnowledgeIndexJob(ctx context.Context, jobID string, data map[string]any) error {
	data["updated_at"] = time.Now()
	_, err := r.db.Model("knowledge_index_jobs").Data(data).Where("id", jobID).Update()
	return err
}

func (r *Repository) SaveCheckpoint(ctx context.Context, record model.CheckpointRecord) error {
	existing, err := r.GetCheckpoint(ctx, record.ID)
	if err != nil {
		return err
	}
	data := map[string]any{
		"id":         record.ID,
		"run_id":     record.RunID,
		"payload":    record.Payload,
		"created_at": record.CreatedAt,
		"updated_at": record.UpdatedAt,
	}
	if existing == nil {
		_, err = r.db.Model("agent_checkpoints").Data(data).Insert()
		return err
	}
	_, err = r.db.Model("agent_checkpoints").Data(data).Where("id", record.ID).Update()
	return err
}

func (r *Repository) GetCheckpoint(ctx context.Context, checkpointID string) (*model.CheckpointRecord, error) {
	var record model.CheckpointRecord
	err := r.db.Model("agent_checkpoints").Where("id", checkpointID).Scan(&record)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if record.ID == "" {
		return nil, nil
	}
	return &record, nil
}
