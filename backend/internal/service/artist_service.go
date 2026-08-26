package service

import (
	"context"
	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

type ArtistService struct {
	repo *repository.Queries
}

func NewArtistService(repo *repository.Queries) *ArtistService {
	return &ArtistService{repo: repo}
}

func (s *ArtistService) ListArtists(ctx context.Context, limit int32, status string, nameKeyword string, cursorID uuid.UUID) ([]repository.Artist, error) {
	return s.repo.ListArtists(ctx, repository.ListArtistsParams{
		Limit:       limit,
		Status:      status,
		NameKeyword: nameKeyword,
		CursorID:    cursorID,
	})
}

func (s *ArtistService) GetArtist(ctx context.Context, id uuid.UUID) (*repository.Artist, error) {
	artist, err := s.repo.GetArtist(ctx, id)
	if err != nil {
		return nil, err
	}
	return &artist, nil
}
