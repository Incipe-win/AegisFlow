package store

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"time"

	"aegisflow-api/internal/model"
	"aegisflow-api/internal/repository"

	"github.com/google/uuid"
)

func EnsurePlatformSchema(ctx context.Context, repo *repository.Repository, seedDir string) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS agent_sessions (
			id VARCHAR(64) PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			mode VARCHAR(64) NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS agent_session_messages (
			id VARCHAR(64) PRIMARY KEY,
			session_id VARCHAR(64) NOT NULL,
			role VARCHAR(32) NOT NULL,
			content LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL,
			INDEX idx_agent_session_messages_session_id (session_id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_runs_v2 (
			id VARCHAR(64) PRIMARY KEY,
			session_id VARCHAR(64) NOT NULL,
			run_type VARCHAR(32) NOT NULL,
			status VARCHAR(32) NOT NULL,
			input_json LONGTEXT NOT NULL,
			output_json LONGTEXT NOT NULL,
			summary LONGTEXT NOT NULL,
			error_message LONGTEXT NULL,
			checkpoint_id VARCHAR(128) NOT NULL,
			interrupt_json LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			completed_at DATETIME NULL,
			INDEX idx_agent_runs_v2_session_id (session_id),
			INDEX idx_agent_runs_v2_status (status)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_run_events (
			id VARCHAR(64) PRIMARY KEY,
			run_id VARCHAR(64) NOT NULL,
			sequence_no INT NOT NULL,
			event_type VARCHAR(64) NOT NULL,
			agent_name VARCHAR(255) NULL,
			role VARCHAR(32) NULL,
			tool_name VARCHAR(255) NULL,
			content LONGTEXT NULL,
			payload_json LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			INDEX idx_agent_run_events_run_id (run_id),
			INDEX idx_agent_run_events_sequence (sequence_no)
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_documents (
			id VARCHAR(64) PRIMARY KEY,
			file_name VARCHAR(255) NOT NULL,
			title VARCHAR(255) NOT NULL,
			content_type VARCHAR(128) NOT NULL,
			file_path VARCHAR(512) NOT NULL,
			status VARCHAR(32) NOT NULL,
			source_type VARCHAR(64) NOT NULL,
			content LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS knowledge_index_jobs (
			id VARCHAR(64) PRIMARY KEY,
			document_id VARCHAR(64) NULL,
			status VARCHAR(32) NOT NULL,
			collection_name VARCHAR(255) NOT NULL,
			chunk_size INT NOT NULL,
			overlap INT NOT NULL,
			top_k INT NOT NULL,
			indexed_chunks INT NOT NULL DEFAULT 0,
			error_message LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			completed_at DATETIME NULL,
			INDEX idx_knowledge_index_jobs_status (status)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_checkpoints (
			id VARCHAR(128) PRIMARY KEY,
			run_id VARCHAR(64) NOT NULL,
			payload LONGBLOB NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			INDEX idx_agent_checkpoints_run_id (run_id)
		)`,
	}
	for _, statement := range statements {
		if _, err := repo.DB().Exec(ctx, statement); err != nil {
			return err
		}
	}
	return seedKnowledgeDocuments(ctx, repo, seedDir)
}

func seedKnowledgeDocuments(ctx context.Context, repo *repository.Repository, seedDir string) error {
	count, err := repo.CountKnowledgeDocuments(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	entries, err := os.ReadDir(seedDir)
	if err != nil {
		return err
	}
	now := time.Now()
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		fullPath := filepath.Join(seedDir, entry.Name())
		content, err := os.ReadFile(fullPath)
		if err != nil {
			return err
		}
		doc := model.KnowledgeDocument{
			ID:          "kdoc-" + uuid.NewString(),
			FileName:    entry.Name(),
			Title:       strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name())),
			ContentType: "text/markdown",
			FilePath:    filepath.ToSlash(fullPath),
			Status:      "uploaded",
			SourceType:  "seed",
			Content:     string(content),
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := repo.CreateKnowledgeDocument(ctx, doc); err != nil {
			return err
		}
	}
	return nil
}
