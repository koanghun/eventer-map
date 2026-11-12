package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"eventer-map-backend/internal/repository"

	"github.com/google/uuid"
)

type fakeEventListRepo struct {
	listEventsCalls               []repository.ListEventsParams
	listMyActionEventsCalls       []repository.ListMyActionEventsParams
	listFollowingArtistEventCalls []repository.ListFollowingArtistsEventsForMapParams
	listEventsRows                []repository.ListEventsRow
	listMyActionRows              []repository.ListMyActionEventsRow
	listFollowingArtistEventRows  []repository.ListFollowingArtistsEventsForMapRow
	err                           error
}

func (f *fakeEventListRepo) ListEvents(_ context.Context, arg repository.ListEventsParams) ([]repository.ListEventsRow, error) {
	f.listEventsCalls = append(f.listEventsCalls, arg)
	if f.err != nil {
		return nil, f.err
	}
	return f.listEventsRows, nil
}

func (f *fakeEventListRepo) ListMyActionEvents(_ context.Context, arg repository.ListMyActionEventsParams) ([]repository.ListMyActionEventsRow, error) {
	f.listMyActionEventsCalls = append(f.listMyActionEventsCalls, arg)
	if f.err != nil {
		return nil, f.err
	}
	return f.listMyActionRows, nil
}

func (f *fakeEventListRepo) ListFollowingArtistsEventsForMap(_ context.Context, arg repository.ListFollowingArtistsEventsForMapParams) ([]repository.ListFollowingArtistsEventsForMapRow, error) {
	f.listFollowingArtistEventCalls = append(f.listFollowingArtistEventCalls, arg)
	if f.err != nil {
		return nil, f.err
	}
	return f.listFollowingArtistEventRows, nil
}

func TestRateEventScoreValidation(t *testing.T) {
	svc := NewEventService(nil, nil)
	ctx := context.Background()
	eventID := uuid.New()
	userID := uuid.New()

	for _, score := range []int32{0, -1, 6, 10} {
		err := svc.RateEvent(ctx, eventID, userID, score)
		if err != ErrInvalidScore {
			t.Errorf("expected ErrInvalidScore for score %d, got %v", score, err)
		}
	}
}

func TestListEventsMyActionRoutingAndPagination(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	event1 := uuid.New()
	event2 := uuid.New()
	venueID := uuid.New()
	now := time.Now().UTC()

	repo := &fakeEventListRepo{
		listMyActionRows: []repository.ListMyActionEventsRow{
			{
				ID:            event1,
				Title:         "Bookmarked Show 1",
				VenueID:       uuid.NullUUID{UUID: venueID, Valid: true},
				VenueName:     "Tokyo Dome",
				Latitude:      35.7056,
				Longitude:     139.7519,
				StartTime:     now,
				EndTime:       now.Add(2 * time.Hour),
				AttendeeCount: 5,
				Status:        "APPROVED",
			},
			{
				ID:            event2,
				Title:         "Bookmarked Show 2",
				VenueID:       uuid.NullUUID{UUID: venueID, Valid: true},
				VenueName:     "Budokan",
				Latitude:      35.6933,
				Longitude:     139.7498,
				StartTime:     now.Add(24 * time.Hour),
				EndTime:       now.Add(26 * time.Hour),
				AttendeeCount: 12,
				Status:        "APPROVED",
			},
		},
	}

	svc := newEventServiceWithListRepo(repo, nil)
	statusBookmarked := int32(1)
	rows, hasMore, err := svc.ListEvents(ctx, ListEventsFilter{
		UserID:       &userID,
		ActionStatus: &statusBookmarked,
		Limit:        1,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.listEventsCalls) != 0 {
		t.Fatalf("expected ListEvents not to be called, got %d calls", len(repo.listEventsCalls))
	}
	if len(repo.listMyActionEventsCalls) != 1 {
		t.Fatalf("expected 1 ListMyActionEvents call, got %d", len(repo.listMyActionEventsCalls))
	}
	call := repo.listMyActionEventsCalls[0]
	if call.UserID != userID || call.ActionStatus != 1 || call.Limit != 2 {
		t.Fatalf("unexpected query params: %+v", call)
	}
	if !hasMore || len(rows) != 1 || rows[0].ID != event1 {
		t.Fatalf("unexpected result: hasMore=%v rows=%+v", hasMore, rows)
	}
}

func TestListEventsMyActionRejectsMissingAuthOrInvalidStatus(t *testing.T) {
	ctx := context.Background()
	repo := &fakeEventListRepo{}
	svc := newEventServiceWithListRepo(repo, nil)

	statusBookmarked := int32(1)
	if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
		ActionStatus: &statusBookmarked,
	}); !errors.Is(err, ErrMyActionAuthRequired) {
		t.Fatalf("expected ErrMyActionAuthRequired, got %v", err)
	}

	nilUser := uuid.Nil
	if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
		UserID:       &nilUser,
		ActionStatus: &statusBookmarked,
	}); !errors.Is(err, ErrMyActionAuthRequired) {
		t.Fatalf("expected ErrMyActionAuthRequired for nil UUID, got %v", err)
	}

	userID := uuid.New()
	for _, badStatus := range []int32{0, 3, -1} {
		s := badStatus
		if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
			UserID:       &userID,
			ActionStatus: &s,
		}); !errors.Is(err, ErrInvalidActionStatus) {
			t.Fatalf("expected ErrInvalidActionStatus for %d, got %v", badStatus, err)
		}
	}

	if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
		UserID: &userID,
	}); !errors.Is(err, ErrInvalidActionStatus) {
		t.Fatalf("expected ErrInvalidActionStatus when UserID set without ActionStatus, got %v", err)
	}

	if len(repo.listEventsCalls) != 0 || len(repo.listMyActionEventsCalls) != 0 {
		t.Fatalf("expected no repository calls on validation error")
	}
}

func TestListEventsDefaultPathUsesListEventsQuery(t *testing.T) {
	ctx := context.Background()
	repo := &fakeEventListRepo{
		listEventsRows: []repository.ListEventsRow{
			{
				ID:        uuid.New(),
				Title:     "Public Event",
				VenueID:   uuid.NullUUID{UUID: uuid.New(), Valid: true},
				Latitude:  35.68,
				Longitude: 139.76,
			},
		},
	}
	svc := newEventServiceWithListRepo(repo, (*sql.DB)(nil))

	minLat := 35.0
	rows, hasMore, err := svc.ListEvents(ctx, ListEventsFilter{
		MinLat: &minLat,
		Limit:  500, // should clamp to MaxEventLimit (100)
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hasMore || len(rows) != 1 {
		t.Fatalf("unexpected rows: hasMore=%v len=%d", hasMore, len(rows))
	}
	if len(repo.listEventsCalls) != 1 || repo.listEventsCalls[0].Limit != MaxEventLimit+1 {
		t.Fatalf("expected limit clamped to %d, got calls=%+v", MaxEventLimit+1, repo.listEventsCalls)
	}
	if len(repo.listMyActionEventsCalls) != 0 {
		t.Fatalf("expected no ListMyActionEvents calls")
	}
	if len(repo.listFollowingArtistEventCalls) != 0 {
		t.Fatalf("expected no ListFollowingArtistsEventsForMap calls")
	}
}

func TestListEventsFollowingArtistsRoutingAndPagination(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	event1 := uuid.New()
	event2 := uuid.New()
	venueID := uuid.New()
	startFrom := time.Date(2026, 11, 12, 0, 0, 0, 0, time.FixedZone("UTC+9", 9*3600))

	repo := &fakeEventListRepo{
		listFollowingArtistEventRows: []repository.ListFollowingArtistsEventsForMapRow{
			{
				ID:            event1,
				Title:         "Followed Artist Live 1",
				VenueID:       uuid.NullUUID{UUID: venueID, Valid: true},
				VenueName:     "Zepp Haneda",
				Latitude:      35.545,
				Longitude:     139.754,
				StartTime:     startFrom.Add(18 * time.Hour),
				EndTime:       startFrom.Add(20 * time.Hour),
				AttendeeCount: 8,
				Status:        "APPROVED",
			},
			{
				ID:            event2,
				Title:         "Followed Artist Live 2",
				VenueID:       uuid.NullUUID{UUID: venueID, Valid: true},
				VenueName:     "Yokohama Arena",
				Latitude:      35.512,
				Longitude:     139.620,
				StartTime:     startFrom.Add(42 * time.Hour),
				EndTime:       startFrom.Add(44 * time.Hour),
				AttendeeCount: 25,
				Status:        "APPROVED",
			},
		},
	}

	svc := newEventServiceWithListRepo(repo, nil)
	rows, hasMore, err := svc.ListEvents(ctx, ListEventsFilter{
		UserID:           &userID,
		FollowingArtists: true,
		StartTimeFrom:    &startFrom,
		Limit:            1,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.listEventsCalls) != 0 || len(repo.listMyActionEventsCalls) != 0 {
		t.Fatalf("expected only ListFollowingArtistsEventsForMap to be called")
	}
	if len(repo.listFollowingArtistEventCalls) != 1 {
		t.Fatalf("expected 1 ListFollowingArtistsEventsForMap call, got %d", len(repo.listFollowingArtistEventCalls))
	}
	call := repo.listFollowingArtistEventCalls[0]
	if call.UserID != userID || !call.StartTimeFrom.Valid || call.StartTimeTo.Valid || call.Limit != 2 {
		t.Fatalf("unexpected query params: %+v", call)
	}
	if !hasMore || len(rows) != 1 || rows[0].ID != event1 {
		t.Fatalf("unexpected result: hasMore=%v rows=%+v", hasMore, rows)
	}
}

func TestListEventsFollowingArtistsValidation(t *testing.T) {
	ctx := context.Background()
	repo := &fakeEventListRepo{}
	svc := newEventServiceWithListRepo(repo, nil)

	if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
		FollowingArtists: true,
	}); !errors.Is(err, ErrFollowingArtistsAuthRequired) {
		t.Fatalf("expected ErrFollowingArtistsAuthRequired, got %v", err)
	}

	userID := uuid.New()
	artistID := uuid.New()
	actionStatus := int32(1)

	if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
		UserID:           &userID,
		FollowingArtists: true,
		ArtistID:         &artistID,
	}); !errors.Is(err, ErrConflictingEventFilters) {
		t.Fatalf("expected ErrConflictingEventFilters for artistId conflict, got %v", err)
	}

	if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
		UserID:           &userID,
		FollowingArtists: true,
		ActionStatus:     &actionStatus,
	}); !errors.Is(err, ErrConflictingEventFilters) {
		t.Fatalf("expected ErrConflictingEventFilters for actionStatus conflict, got %v", err)
	}

	if len(repo.listFollowingArtistEventCalls) != 0 {
		t.Fatalf("expected no repo calls on validation errors")
	}

	createdAfter := time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC)
	if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
		FollowingArtists: false,
		CreatedAfter:     &createdAfter,
	}); !errors.Is(err, ErrConflictingEventFilters) {
		t.Fatalf("expected ErrConflictingEventFilters when CreatedAfter is set without FollowingArtists, got %v", err)
	}
}

func TestListEventsFollowingArtistsCreatedAfterPassThrough(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	createdAfter := time.Date(2026, 11, 10, 15, 30, 0, 123456000, time.FixedZone("UTC+9", 9*3600))

	repo := &fakeEventListRepo{}
	svc := newEventServiceWithListRepo(repo, nil)

	if _, _, err := svc.ListEvents(ctx, ListEventsFilter{
		UserID:           &userID,
		FollowingArtists: true,
		CreatedAfter:     &createdAfter,
		Limit:            50,
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(repo.listFollowingArtistEventCalls) != 1 {
		t.Fatalf("expected 1 call, got %d", len(repo.listFollowingArtistEventCalls))
	}
	call := repo.listFollowingArtistEventCalls[0]
	if !call.CreatedAfter.Valid || !call.CreatedAfter.Time.Equal(createdAfter.UTC()) {
		t.Fatalf("expected CreatedAfter=%v, got %+v", createdAfter.UTC(), call.CreatedAfter)
	}
}
