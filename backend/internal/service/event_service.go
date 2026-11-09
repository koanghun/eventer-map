package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrUserBanned     = errors.New("user is banned")
	ErrEventNotEnded  = errors.New("event has not ended yet")
	ErrNotAttendee    = errors.New("only attendees can rate the event")
	ErrInvalidScore   = errors.New("score must be between 1 and 5")
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

type CreateEventInput struct {
	Title          string
	VenueID        uuid.UUID
	ArtistIDs      []uuid.UUID
	OpeningTime    *time.Time
	StartTime      time.Time
	EndTime        time.Time
	RelatedLinks   []string
	PosterImageURL *string
	AuthorID       uuid.UUID
}

type EventDetail struct {
	Event         repository.Event
	Venue         *repository.Venue
	Artists       []repository.Artist
	AttendeeCount int32
}

type EventService struct {
	repo *repository.Queries
	db   *sql.DB
}

func NewEventService(repo *repository.Queries, db *sql.DB) *EventService {
	return &EventService{repo: repo, db: db}
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
		if row, err := s.repo.GetVenue(ctx, event.VenueID.UUID); err == nil {
			venue := repository.Venue(row)
			detail.Venue = &venue
		}
	}

	if rows, err := s.repo.GetArtistsForEvent(ctx, id); err == nil {
		artists := make([]repository.Artist, len(rows))
		for i, r := range rows {
			artists[i] = repository.Artist(r)
		}
		detail.Artists = artists
	}

	if attendeeCount, err := s.repo.CountEventAttendees(ctx, id); err == nil {
		detail.AttendeeCount = attendeeCount
	}

	return detail, nil
}

func (s *EventService) CreateEvent(ctx context.Context, input CreateEventInput) (*EventDetail, error) {
	status := "PENDING"
	if user, err := s.repo.GetUserByID(ctx, input.AuthorID); err == nil {
		if user.IsBanned {
			return nil, ErrUserBanned
		}
		if user.Role == "ADMIN" {
			status = "APPROVED"
		}
	}

	relatedLinks := input.RelatedLinks
	if relatedLinks == nil {
		relatedLinks = []string{}
	}

	params := repository.CreateEventParams{
		Title:        strings.TrimSpace(input.Title),
		VenueID:      uuid.NullUUID{UUID: input.VenueID, Valid: input.VenueID != uuid.Nil},
		StartTime:    input.StartTime,
		EndTime:      input.EndTime,
		RelatedLinks: relatedLinks,
		Status:       status,
		AuthorID:     uuid.NullUUID{UUID: input.AuthorID, Valid: input.AuthorID != uuid.Nil},
	}

	if input.OpeningTime != nil {
		params.OpeningTime = sql.NullTime{Time: *input.OpeningTime, Valid: true}
	}
	if input.PosterImageURL != nil && strings.TrimSpace(*input.PosterImageURL) != "" {
		params.PosterImageUrl = sql.NullString{String: strings.TrimSpace(*input.PosterImageURL), Valid: true}
	}

	var createdEvent repository.Event

	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()

		q := s.repo.WithTx(tx)

		createdEvent, err = q.CreateEvent(ctx, params)
		if err != nil {
			return nil, err
		}

		for _, artistID := range input.ArtistIDs {
			if artistID == uuid.Nil {
				continue
			}
			if err := q.AddArtistToEvent(ctx, repository.AddArtistToEventParams{
				EventID:  createdEvent.ID,
				ArtistID: artistID,
			}); err != nil {
				return nil, err
			}
		}

		snapshotData, err := json.Marshal(map[string]interface{}{
			"title":        createdEvent.Title,
			"venueId":      input.VenueID,
			"artistIds":    input.ArtistIDs,
			"openingTime":  input.OpeningTime,
			"startTime":    createdEvent.StartTime,
			"endTime":      createdEvent.EndTime,
			"relatedLinks": relatedLinks,
		})
		if err == nil {
			_, _ = q.CreateEventHistory(ctx, repository.CreateEventHistoryParams{
				EventID:  createdEvent.ID,
				EditorID: uuid.NullUUID{UUID: input.AuthorID, Valid: input.AuthorID != uuid.Nil},
				Snapshot: snapshotData,
			})
		}

		if err := tx.Commit(); err != nil {
			return nil, err
		}
	} else {
		var err error
		createdEvent, err = s.repo.CreateEvent(ctx, params)
		if err != nil {
			return nil, err
		}
		for _, artistID := range input.ArtistIDs {
			if artistID == uuid.Nil {
				continue
			}
			_ = s.repo.AddArtistToEvent(ctx, repository.AddArtistToEventParams{
				EventID:  createdEvent.ID,
				ArtistID: artistID,
			})
		}
	}

	return s.GetEventDetail(ctx, createdEvent.ID)
}

func (s *EventService) UpdateEvent(ctx context.Context, eventID uuid.UUID, input CreateEventInput) (*EventDetail, error) {
	if user, err := s.repo.GetUserByID(ctx, input.AuthorID); err == nil {
		if user.IsBanned {
			return nil, ErrUserBanned
		}
	}

	if _, err := s.repo.GetEvent(ctx, eventID); err != nil {
		return nil, err
	}

	relatedLinks := input.RelatedLinks
	if relatedLinks == nil {
		relatedLinks = []string{}
	}

	params := repository.UpdateEventParams{
		ID:           eventID,
		Title:        sql.NullString{String: strings.TrimSpace(input.Title), Valid: true},
		VenueID:      uuid.NullUUID{UUID: input.VenueID, Valid: input.VenueID != uuid.Nil},
		StartTime:    sql.NullTime{Time: input.StartTime, Valid: true},
		EndTime:      sql.NullTime{Time: input.EndTime, Valid: true},
		RelatedLinks: relatedLinks,
	}

	if input.OpeningTime != nil {
		params.OpeningTime = sql.NullTime{Time: *input.OpeningTime, Valid: true}
	}
	if input.PosterImageURL != nil && strings.TrimSpace(*input.PosterImageURL) != "" {
		params.PosterImageUrl = sql.NullString{String: strings.TrimSpace(*input.PosterImageURL), Valid: true}
	}

	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()

		q := s.repo.WithTx(tx)

		updatedEvent, err := q.UpdateEvent(ctx, params)
		if err != nil {
			return nil, err
		}

		if err := q.ClearArtistsFromEvent(ctx, eventID); err != nil {
			return nil, err
		}

		for _, artistID := range input.ArtistIDs {
			if artistID == uuid.Nil {
				continue
			}
			if err := q.AddArtistToEvent(ctx, repository.AddArtistToEventParams{
				EventID:  eventID,
				ArtistID: artistID,
			}); err != nil {
				return nil, err
			}
		}

		snapshotData, err := json.Marshal(map[string]interface{}{
			"title":        updatedEvent.Title,
			"venueId":      input.VenueID,
			"artistIds":    input.ArtistIDs,
			"openingTime":  input.OpeningTime,
			"startTime":    updatedEvent.StartTime,
			"endTime":      updatedEvent.EndTime,
			"relatedLinks": relatedLinks,
		})
		if err == nil {
			_, _ = q.CreateEventHistory(ctx, repository.CreateEventHistoryParams{
				EventID:  eventID,
				EditorID: uuid.NullUUID{UUID: input.AuthorID, Valid: input.AuthorID != uuid.Nil},
				Snapshot: snapshotData,
			})
		}

		// 공연장 및 출연자들의 평점을 이벤트 평균 평점 기준으로 재계산하여 동기화
		if input.VenueID != uuid.Nil {
			_ = q.RecalculateVenueRatingFromEvents(ctx, input.VenueID)
		}
		_ = q.RecalculateEventArtistsRatingFromEvents(ctx, eventID)

		if err := tx.Commit(); err != nil {
			return nil, err
		}
	} else {
		if _, err := s.repo.UpdateEvent(ctx, params); err != nil {
			return nil, err
		}
		_ = s.repo.ClearArtistsFromEvent(ctx, eventID)
		for _, artistID := range input.ArtistIDs {
			if artistID == uuid.Nil {
				continue
			}
			_ = s.repo.AddArtistToEvent(ctx, repository.AddArtistToEventParams{
				EventID:  eventID,
				ArtistID: artistID,
			})
		}
	}

	return s.GetEventDetail(ctx, eventID)
}

func (s *EventService) RateEvent(ctx context.Context, eventID, userID uuid.UUID, score int32) error {
	if score < 1 || score > 5 {
		return ErrInvalidScore
	}

	if s.db == nil {
		return s.repo.RateEvent(ctx, repository.RateEventParams{
			EventID: eventID,
			UserID:  userID,
			Score:   score,
		})
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	q := s.repo.WithTx(tx)

	event, err := q.GetEventForUpdate(ctx, eventID)
	if err != nil {
		return err
	}

	if time.Now().Before(event.EndTime) {
		return ErrEventNotEnded
	}

	actionStatus, err := q.GetUserEventAction(ctx, repository.GetUserEventActionParams{
		UserID:  userID,
		EventID: eventID,
	})
	if err != nil || actionStatus != 2 {
		return ErrNotAttendee
	}

	prevRating, err := q.GetUserRatingForEvent(ctx, repository.GetUserRatingForEventParams{
		UserID:  userID,
		EventID: eventID,
	})

	var scoreDelta float64
	var countDelta int32

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			scoreDelta = float64(score)
			countDelta = 1
		} else {
			return err
		}
	} else {
		scoreDelta = float64(score - prevRating.Score)
		countDelta = 0
	}

	if err := q.RateEvent(ctx, repository.RateEventParams{
		UserID:  userID,
		EventID: eventID,
		Score:   score,
	}); err != nil {
		return err
	}

	if scoreDelta != 0 || countDelta != 0 {
		if err := q.UpdateEventRating(ctx, repository.UpdateEventRatingParams{
			ScoreDelta: scoreDelta,
			CountDelta: countDelta,
			ID:         eventID,
		}); err != nil {
			return err
		}

		// 이벤트 평점이 갱신되면 해당 공연장(해당 공연장에서 개최한 이벤트들의 평균 평점)과
		// 참가 출연자(해당 출연자가 참가한 이벤트들의 평균 평점)를 즉시 재계산
		if event.VenueID.Valid {
			if err := q.RecalculateVenueRatingFromEvents(ctx, event.VenueID.UUID); err != nil {
				return err
			}
		}

		if err := q.RecalculateEventArtistsRatingFromEvents(ctx, eventID); err != nil {
			return err
		}
	}

	return tx.Commit()
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
