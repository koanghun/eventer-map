package service

import (
	"context"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

type EventService struct {
	repo *repository.Queries
}

func NewEventService(repo *repository.Queries) *EventService {
	return &EventService{repo: repo}
}

func (s *EventService) ListEvents(ctx context.Context, limit int32, venueId uuid.UUID) ([]repository.Event, error) {
	// For simplicity in Phase 2, we omit time filters and cursor
	return s.repo.ListEvents(ctx, repository.ListEventsParams{
		Limit:   limit,
		VenueID: venueId,
	})
}

func (s *EventService) GetEvent(ctx context.Context, id uuid.UUID) (*repository.Event, error) {
	event, err := s.repo.GetEvent(ctx, id)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

func (s *EventService) CreateEvent(ctx context.Context, arg repository.CreateEventParams) (*repository.Event, error) {
	event, err := s.repo.CreateEvent(ctx, arg)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

func (s *EventService) RateEvent(ctx context.Context, eventID, userID uuid.UUID, score int32) error {
	// In a real scenario, this would use a transaction to update both event_ratings and the running totals on events.
	return s.repo.RateEvent(ctx, repository.RateEventParams{
		EventID: eventID,
		UserID:  userID,
		Score:   score,
	})
}
