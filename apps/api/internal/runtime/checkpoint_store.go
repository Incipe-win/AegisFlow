package runtime

import (
	"context"
	"time"

	"aegisflow-api/internal/model"
	"aegisflow-api/internal/repository"
)

type CheckpointStore struct {
	repo *repository.Repository
}

func NewCheckpointStore(repo *repository.Repository) *CheckpointStore {
	return &CheckpointStore{repo: repo}
}

func (s *CheckpointStore) Get(ctx context.Context, checkPointID string) ([]byte, bool, error) {
	record, err := s.repo.GetCheckpoint(ctx, checkPointID)
	if err != nil {
		return nil, false, err
	}
	if record == nil {
		return nil, false, nil
	}
	return record.Payload, true, nil
}

func (s *CheckpointStore) Set(ctx context.Context, checkPointID string, checkPoint []byte) error {
	now := time.Now()
	return s.repo.SaveCheckpoint(ctx, model.CheckpointRecord{
		ID:        checkPointID,
		RunID:     checkPointID,
		Payload:   checkPoint,
		CreatedAt: now,
		UpdatedAt: now,
	})
}
