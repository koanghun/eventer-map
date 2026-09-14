package service

import (
	"context"
	"eventer-map-backend/internal/repository"
)

type StatsService struct {
	repo *repository.Queries
}

func NewStatsService(repo *repository.Queries) *StatsService {
	return &StatsService{
		repo: repo,
	}
}

func (s *StatsService) IncrementDailyVisit(ctx context.Context) (int32, error) {
	return s.repo.IncrementDailyVisit(ctx)
}

func (s *StatsService) GetDailyVisit(ctx context.Context) (int32, error) {
	return s.repo.GetDailyVisit(ctx)
}
