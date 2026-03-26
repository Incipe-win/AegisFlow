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

func Bootstrap(ctx context.Context, repo *repository.Repository, seedDir string, uploadDir string) error {
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return err
	}
	if err := ensureTables(ctx, repo); err != nil {
		return err
	}
	return seedDocuments(ctx, repo, seedDir)
}

func ensureTables(ctx context.Context, repo *repository.Repository) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS documents (
			id VARCHAR(64) PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			source_type VARCHAR(64) NOT NULL,
			file_path VARCHAR(512) NOT NULL,
			file_size BIGINT NOT NULL DEFAULT 0,
			status VARCHAR(32) NOT NULL,
			content LONGTEXT NOT NULL,
			indexed_at DATETIME NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS document_chunks (
			id VARCHAR(64) PRIMARY KEY,
			document_id VARCHAR(64) NOT NULL,
			position INT NOT NULL,
			content LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL,
			INDEX idx_document_id (document_id)
		)`,
		`CREATE TABLE IF NOT EXISTS chat_messages (
			id VARCHAR(64) PRIMARY KEY,
			session_id VARCHAR(128) NOT NULL,
			role VARCHAR(32) NOT NULL,
			content LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL,
			INDEX idx_session_id (session_id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_runs (
			id VARCHAR(64) PRIMARY KEY,
			run_type VARCHAR(32) NOT NULL,
			status VARCHAR(32) NOT NULL,
			summary LONGTEXT NOT NULL,
			detail_json LONGTEXT NOT NULL,
			references_json LONGTEXT NOT NULL,
			tool_calls_json LONGTEXT NOT NULL,
			created_at DATETIME NOT NULL
		)`,
	}
	for _, statement := range statements {
		if _, err := repo.DB().Exec(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func seedDocuments(ctx context.Context, repo *repository.Repository, seedDir string) error {
	count, err := repo.CountDocuments(ctx)
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
		doc := model.DocumentRecord{
			ID:         "doc-" + uuid.NewString(),
			Title:      strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name())),
			SourceType: "seed",
			FilePath:   filepath.ToSlash(fullPath),
			FileSize:   int64(len(content)),
			Status:     "uploaded",
			Content:    string(content),
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := repo.SaveDocument(ctx, doc); err != nil {
			return err
		}
	}
	return nil
}
