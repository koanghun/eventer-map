package service

import (
	"context"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

type UserService struct {
	repo *repository.Queries
}

func NewUserService(repo *repository.Queries) *UserService {
	return &UserService{repo: repo}
}
func (s *UserService) ListUserEventActions(ctx context.Context, userID uuid.UUID) ([]repository.EventUserAction, error) {
	return s.repo.ListUserEventActions(ctx, userID)
}
