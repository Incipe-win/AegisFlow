package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"aegisflow-api/internal/model"

	"github.com/gogf/gf/v2/database/gdb"
)

type Repository struct {
	db gdb.DB
}

func New(db gdb.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) DB() gdb.DB {
	return r.db
}

func (r *Repository) CountDocuments(ctx context.Context) (int, error) {
	return r.db.Model("documents").Count()
}

func (r *Repository) GetDocumentByID(ctx context.Context, id string) (*model.DocumentRecord, error) {
	var doc model.DocumentRecord
	err := r.db.Model("documents").Where("id", id).Scan(&doc)
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

func (r *Repository) SaveDocument(ctx context.Context, doc model.DocumentRecord) error {
	existing, err := r.GetDocumentByID(ctx, doc.ID)
	if err != nil {
		return err
	}
	data := map[string]any{
		"id":          doc.ID,
		"title":       doc.Title,
		"source_type": doc.SourceType,
		"file_path":   doc.FilePath,
		"file_size":   doc.FileSize,
		"status":      doc.Status,
		"content":     doc.Content,
		"indexed_at":  doc.IndexedAt,
		"created_at":  doc.CreatedAt,
		"updated_at":  doc.UpdatedAt,
	}
	if existing == nil {
		_, err = r.db.Model("documents").Data(data).Insert()
		return err
	}
	_, err = r.db.Model("documents").Data(data).Where("id", doc.ID).Update()
	return err
}

func (r *Repository) ListDocumentsForIndex(ctx context.Context, ids []string) ([]model.DocumentRecord, error) {
	var docs []model.DocumentRecord
	query := r.db.Model("documents")
	if len(ids) > 0 {
		query = query.WhereIn("id", ids)
	}
	err := query.OrderAsc("created_at").Scan(&docs)
	return docs, err
}

func (r *Repository) DeleteChunksForDocuments(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.db.Model("document_chunks").WhereIn("document_id", ids).Delete()
	return err
}

func (r *Repository) InsertChunk(ctx context.Context, chunk model.DocumentChunkRecord) error {
	_, err := r.db.Model("document_chunks").Data(map[string]any{
		"id":          chunk.ID,
		"document_id": chunk.DocumentID,
		"position":    chunk.Position,
		"content":     chunk.Content,
		"created_at":  chunk.CreatedAt,
	}).Insert()
	return err
}

func (r *Repository) ListChunkViews(ctx context.Context) ([]model.DocumentChunkView, error) {
	var views []model.DocumentChunkView
	err := r.db.Model("document_chunks dc").
		LeftJoin("documents d", "d.id=dc.document_id").
		Fields("dc.document_id", "d.title", "dc.content").
		OrderAsc("dc.document_id").
		OrderAsc("dc.position").
		Scan(&views)
	return views, err
}

func (r *Repository) SaveChatMessage(ctx context.Context, msg model.ChatMessageRecord) error {
	_, err := r.db.Model("chat_messages").Data(map[string]any{
		"id":         msg.ID,
		"session_id": msg.SessionID,
		"role":       msg.Role,
		"content":    msg.Content,
		"created_at": msg.CreatedAt,
	}).Insert()
	return err
}

func (r *Repository) ListChatMessages(ctx context.Context, sessionID string, limit int) ([]model.ChatMessageRecord, error) {
	var messages []model.ChatMessageRecord
	query := r.db.Model("chat_messages").Where("session_id", sessionID).OrderAsc("created_at")
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Scan(&messages)
	return messages, err
}

func (r *Repository) SaveRun(ctx context.Context, run model.RunRecord) error {
	_, err := r.db.Model("agent_runs").Data(map[string]any{
		"id":              run.ID,
		"run_type":        run.RunType,
		"status":          run.Status,
		"summary":         run.Summary,
		"detail_json":     run.DetailJSON,
		"references_json": run.ReferencesJSON,
		"tool_calls_json": run.ToolCallsJSON,
		"created_at":      run.CreatedAt,
	}).Insert()
	return err
}

func (r *Repository) GetRun(ctx context.Context, runID string) (*model.RunRecord, error) {
	var run model.RunRecord
	err := r.db.Model("agent_runs").Where("id", runID).Scan(&run)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if run.ID == "" {
		return nil, nil
	}
	return &run, nil
}

func (r *Repository) TouchDocumentIndexed(ctx context.Context, id string, indexedAt time.Time) error {
	_, err := r.db.Model("documents").Data(map[string]any{
		"status":     "indexed",
		"indexed_at": indexedAt,
		"updated_at": indexedAt,
	}).Where("id", id).Update()
	return err
}
