package service

import (
	"context"
	"database/sql"
	"time"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

const (
	DefaultEventLimit int32 = 50
	MaxEventLimit     int32 = 100
)

type ListEventsFilter struct {
	MinLat        *float64
	MaxLat        *float64
	MinLng        *float64
	MaxLng        *float64
	StartTimeFrom *time.Time
	StartTimeTo   *time.Time
	VenueID       *uuid.UUID
	ArtistID      *uuid.UUID
	Status        *string
	Limit         int32
}

type EventDetail struct {
	Event         repository.Event
	Venue         *repository.Venue
	Artists       []repository.Artist
	AttendeeCount int32
}

type EventService struct {
	repo *repository.Queries
}

func NewEventService(repo *repository.Queries) *EventService {
	return &EventService{repo: repo}
}

func (s *EventService) ListEvents(ctx context.Context, filter ListEventsFilter) ([]repository.ListEventsRow, bool, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = DefaultEventLimit
	}
	if limit > MaxEventLimit {
		limit = MaxEventLimit
	}

	params := repository.ListEventsParams{
		Limit: limit + 1, // Fetch 1 extra row to determine hasMore without COUNT(*) query
	}

	if filter.MinLat != nil {
		params.MinLat = sql.NullFloat64{Float64: *filter.MinLat, Valid: true}
	}
	if filter.MaxLat != nil {
		params.MaxLat = sql.NullFloat64{Float64: *filter.MaxLat, Valid: true}
	}
	if filter.MinLng != nil {
		params.MinLng = sql.NullFloat64{Float64: *filter.MinLng, Valid: true}
	}
	if filter.MaxLng != nil {
		params.MaxLng = sql.NullFloat64{Float64: *filter.MaxLng, Valid: true}
	}
	if filter.StartTimeFrom != nil {
		params.StartTimeFrom = sql.NullTime{Time: *filter.StartTimeFrom, Valid: true}
	}
	if filter.StartTimeTo != nil {
		params.StartTimeTo = sql.NullTime{Time: *filter.StartTimeTo, Valid: true}
	}
	if filter.VenueID != nil && *filter.VenueID != uuid.Nil {
		params.VenueID = uuid.NullUUID{UUID: *filter.VenueID, Valid: true}
	}
	if filter.ArtistID != nil && *filter.ArtistID != uuid.Nil {
		params.ArtistID = uuid.NullUUID{UUID: *filter.ArtistID, Valid: true}
	}
	if filter.Status != nil && *filter.Status != "" {
		params.Status = sql.NullString{String: *filter.Status, Valid: true}
	}

	rows, err := s.repo.ListEvents(ctx, params)
	if err != nil {
		return nil, false, err
	}

	hasMore := false
	if int32(len(rows)) > limit {
		hasMore = true
		rows = rows[:limit]
	}

	return rows, hasMore, nil
}

func (s *EventService) GetEvent(ctx context.Context, id uuid.UUID) (*repository.Event, error) {
	event, err := s.repo.GetEvent(ctx, id)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

func (s *EventService) GetEventDetail(ctx context.Context, id uuid.UUID) (*EventDetail, error) {
	event, err := s.repo.GetEvent(ctx, id)
	if err != nil {
		return nil, err
	}

	detail := &EventDetail{
		Event: event,
	}

	if event.VenueID.Valid {
		if venue, err := s.repo.GetVenue(ctx, event.VenueID.UUID); err == nil {
			detail.Venue = &venue
		}
	}

	if artists, err := s.repo.GetArtistsForEvent(ctx, id); err == nil {
		detail.Artists = artists
	}

	if attendeeCount, err := s.repo.CountEventAttendees(ctx, id); err == nil {
		detail.AttendeeCount = attendeeCount
	}

	return detail, nil
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

func (s *EventService) PutEventAction(ctx context.Context, userID, eventID uuid.UUID, status int32) error {
	if status == 0 {
		return s.repo.DeleteUserEventAction(ctx, repository.DeleteUserEventActionParams{
			UserID:  userID,
			EventID: eventID,
		})
	}
	return s.repo.UpsertUserEventAction(ctx, repository.UpsertUserEventActionParams{
		UserID:  userID,
		EventID: eventID,
		Status:  status,
	})
}

func (s *EventService) GetEventAttendees(ctx context.Context, viewerID, eventID uuid.UUID, limit, offset int32) ([]repository.GetEventAttendeesRow, error) {
	return s.repo.GetEventAttendees(ctx, repository.GetEventAttendeesParams{
		EventID:   eventID,
		BlockerID: viewerID,
		Limit:     limit,
		Offset:    offset,
	})
}
