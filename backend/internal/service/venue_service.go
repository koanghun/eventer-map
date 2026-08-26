package service

import (
	"context"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

type VenueService struct {
	repo *repository.Queries
}

func NewVenueService(repo *repository.Queries) *VenueService {
	return &VenueService{repo: repo}
}

func (s *VenueService) ListVenuesByBoundingBox(ctx context.Context, minLat, maxLat, minLng, maxLng float64, status, nameKeyword string) ([]repository.Venue, error) {
	return s.repo.ListVenuesByBoundingBox(ctx, repository.ListVenuesByBoundingBoxParams{
		MinLat:   minLat,
		MaxLat:   maxLat,
		MinLon:   minLng, // Map Lng to Lon
		MaxLon:   maxLng, // Map Lng to Lon
		Status:   status,
		CursorID: uuid.Nil,
	})
}

func (s *VenueService) GetVenue(ctx context.Context, id uuid.UUID) (*repository.Venue, error) {
	venue, err := s.repo.GetVenue(ctx, id)
	if err != nil {
		return nil, err
	}
	return &venue, nil
}
