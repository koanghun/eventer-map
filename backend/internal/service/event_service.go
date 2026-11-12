package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrUserBanned                    = errors.New("user is banned")
	ErrEventNotEnded                 = errors.New("event has not ended yet")
	ErrNotAttendee                   = errors.New("only attendees can rate the event")
	ErrInvalidScore                  = errors.New("score must be between 1 and 5")
	ErrMyActionAuthRequired          = errors.New("authenticated user is required for myAction filter")
	ErrFollowingArtistsAuthRequired  = errors.New("authenticated user is required for followingArtists filter")
	ErrConflictingEventFilters       = errors.New("conflicting event filters")
	ErrInvalidActionStatus           = errors.New("action status must be 1 or 2")
)

const (
	DefaultEventLimit int32 = 50
	MaxEventLimit     int32 = 100
)

type ListEventsFilter struct {
	MinLat           *float64
	MaxLat           *float64
	MinLng           *float64
	MaxLng           *float64
	StartTimeFrom    *time.Time
	StartTimeTo      *time.Time
	VenueID          *uuid.UUID
	ArtistID         *uuid.UUID
	Status           *string
	UserID           *uuid.UUID
	ActionStatus     *int32
	FollowingArtists bool
	Limit            int32
}

type eventListRepository interface {
	ListEvents(ctx context.Context, arg repository.ListEventsParams) ([]repository.ListEventsRow, error)
	ListMyActionEvents(ctx context.Context, arg repository.ListMyActionEventsParams) ([]repository.ListMyActionEventsRow, error)
	ListFollowingArtistsEventsForMap(ctx context.Context, arg repository.ListFollowingArtistsEventsForMapParams) ([]repository.ListFollowingArtistsEventsForMapRow, error)
}

type CreateEventInput struct {
	Title        string
	VenueID      uuid.UUID
	ArtistIDs    []uuid.UUID
	OpeningTime  *time.Time
	StartTime    time.Time
	EndTime      time.Time
	RelatedLinks []string
	AuthorID     uuid.UUID
}

type EventDetail struct {
	Event         repository.Event
	Venue         *repository.Venue
	Artists       []repository.Artist
	AttendeeCount int32
	MyRating      *int32
}

type EventService struct {
	repo     *repository.Queries
	listRepo eventListRepository
	db       *sql.DB
}

func NewEventService(repo *repository.Queries, db *sql.DB) *EventService {
	var listRepo eventListRepository
	if repo != nil {
		listRepo = repo
	}
	return &EventService{repo: repo, listRepo: listRepo, db: db}
}

func newEventServiceWithListRepo(listRepo eventListRepository, db *sql.DB) *EventService {
	return &EventService{listRepo: listRepo, db: db}
}

type commonEventListFilter struct {
	MinLat        sql.NullFloat64
	MaxLat        sql.NullFloat64
	MinLng        sql.NullFloat64
	MaxLng        sql.NullFloat64
	StartTimeFrom sql.NullTime
	StartTimeTo   sql.NullTime
	VenueID       uuid.NullUUID
	ArtistID      uuid.NullUUID
	Status        sql.NullString
	QueryLimit    int32
}

func buildCommonEventListFilter(filter ListEventsFilter, queryLimit int32) commonEventListFilter {
	out := commonEventListFilter{
		QueryLimit: queryLimit,
	}
	if filter.MinLat != nil {
		out.MinLat = sql.NullFloat64{Float64: *filter.MinLat, Valid: true}
	}
	if filter.MaxLat != nil {
		out.MaxLat = sql.NullFloat64{Float64: *filter.MaxLat, Valid: true}
	}
	if filter.MinLng != nil {
		out.MinLng = sql.NullFloat64{Float64: *filter.MinLng, Valid: true}
	}
	if filter.MaxLng != nil {
		out.MaxLng = sql.NullFloat64{Float64: *filter.MaxLng, Valid: true}
	}
	if filter.StartTimeFrom != nil {
		out.StartTimeFrom = sql.NullTime{Time: *filter.StartTimeFrom, Valid: true}
	}
	if filter.StartTimeTo != nil {
		out.StartTimeTo = sql.NullTime{Time: *filter.StartTimeTo, Valid: true}
	}
	if filter.VenueID != nil && *filter.VenueID != uuid.Nil {
		out.VenueID = uuid.NullUUID{UUID: *filter.VenueID, Valid: true}
	}
	if filter.ArtistID != nil && *filter.ArtistID != uuid.Nil {
		out.ArtistID = uuid.NullUUID{UUID: *filter.ArtistID, Valid: true}
	}
	if filter.Status != nil && *filter.Status != "" {
		out.Status = sql.NullString{String: *filter.Status, Valid: true}
	}
	return out
}

func (s *EventService) ListEvents(ctx context.Context, filter ListEventsFilter) ([]repository.ListEventsRow, bool, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = DefaultEventLimit
	}
	if limit > MaxEventLimit {
		limit = MaxEventLimit
	}

	// Fetch 1 extra row to determine hasMore without COUNT(*) query
	common := buildCommonEventListFilter(filter, limit+1)

	var rows []repository.ListEventsRow
	if filter.FollowingArtists && (filter.ActionStatus != nil || (filter.ArtistID != nil && *filter.ArtistID != uuid.Nil)) {
		return nil, false, ErrConflictingEventFilters
	}

	if filter.FollowingArtists {
		if filter.UserID == nil || *filter.UserID == uuid.Nil {
			return nil, false, ErrFollowingArtistsAuthRequired
		}

		followedRows, err := s.listRepo.ListFollowingArtistsEventsForMap(ctx, repository.ListFollowingArtistsEventsForMapParams{
			UserID:        *filter.UserID,
			MinLat:        common.MinLat,
			MaxLat:        common.MaxLat,
			MinLng:        common.MinLng,
			MaxLng:        common.MaxLng,
			StartTimeFrom: common.StartTimeFrom,
			StartTimeTo:   common.StartTimeTo,
			VenueID:       common.VenueID,
			Status:        common.Status,
			Limit:         common.QueryLimit,
		})
		if err != nil {
			return nil, false, err
		}

		rows = make([]repository.ListEventsRow, len(followedRows))
		for i, r := range followedRows {
			rows[i] = repository.ListEventsRow(r)
		}
	} else if filter.ActionStatus != nil || filter.UserID != nil {
		if filter.UserID == nil || *filter.UserID == uuid.Nil {
			return nil, false, ErrMyActionAuthRequired
		}
		if filter.ActionStatus == nil || (*filter.ActionStatus != 1 && *filter.ActionStatus != 2) {
			return nil, false, ErrInvalidActionStatus
		}

		actionRows, err := s.listRepo.ListMyActionEvents(ctx, repository.ListMyActionEventsParams{
			UserID:        *filter.UserID,
			ActionStatus:  *filter.ActionStatus,
			MinLat:        common.MinLat,
			MaxLat:        common.MaxLat,
			MinLng:        common.MinLng,
			MaxLng:        common.MaxLng,
			StartTimeFrom: common.StartTimeFrom,
			StartTimeTo:   common.StartTimeTo,
			VenueID:       common.VenueID,
			ArtistID:      common.ArtistID,
			Status:        common.Status,
			Limit:         common.QueryLimit,
		})
		if err != nil {
			return nil, false, err
		}

		rows = make([]repository.ListEventsRow, len(actionRows))
		for i, r := range actionRows {
			rows[i] = repository.ListEventsRow(r)
		}
	} else {
		var err error
		rows, err = s.listRepo.ListEvents(ctx, repository.ListEventsParams{
			MinLat:        common.MinLat,
			MaxLat:        common.MaxLat,
			MinLng:        common.MinLng,
			MaxLng:        common.MaxLng,
			StartTimeFrom: common.StartTimeFrom,
			StartTimeTo:   common.StartTimeTo,
			VenueID:       common.VenueID,
			ArtistID:      common.ArtistID,
			Status:        common.Status,
			Limit:         common.QueryLimit,
		})
		if err != nil {
			return nil, false, err
		}
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

	oldEvent, err := s.repo.GetEvent(ctx, eventID)
	if err != nil {
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

	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()

		q := s.repo.WithTx(tx)

		oldArtists, _ := q.GetArtistsForEvent(ctx, eventID)

		if _, err := q.UpdateEvent(ctx, params); err != nil {
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

		// 공연장 및 출연자들의 평점을 이벤트 평균 평점 기준으로 재계산하여 동기화
		if oldEvent.VenueID.Valid && oldEvent.VenueID.UUID != input.VenueID {
			_ = q.RecalculateVenueRatingFromEvents(ctx, oldEvent.VenueID.UUID)
		}
		if input.VenueID != uuid.Nil {
			_ = q.RecalculateVenueRatingFromEvents(ctx, input.VenueID)
		}
		for _, oa := range oldArtists {
			_ = q.RecalculateArtistRatingFromEvents(ctx, oa.ID)
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

func (s *EventService) GetUserRating(ctx context.Context, eventID, userID uuid.UUID) (*int32, error) {
	r, err := s.repo.GetUserRatingForEvent(ctx, repository.GetUserRatingForEventParams{
		UserID:  userID,
		EventID: eventID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	score := r.Score
	return &score, nil
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

func (s *EventService) DeleteEventRating(ctx context.Context, eventID, userID uuid.UUID) error {
	if s.db == nil {
		return s.repo.DeleteUserEventRating(ctx, repository.DeleteUserEventRatingParams{
			UserID:  userID,
			EventID: eventID,
		})
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	q := s.repo.WithTx(tx)

	prevRating, err := q.GetUserRatingForEvent(ctx, repository.GetUserRatingForEventParams{
		UserID:  userID,
		EventID: eventID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		return err
	}

	if err := q.DeleteUserEventRating(ctx, repository.DeleteUserEventRatingParams{
		UserID:  userID,
		EventID: eventID,
	}); err != nil {
		return err
	}

	if err := q.UpdateEventRating(ctx, repository.UpdateEventRatingParams{
		ScoreDelta: -float64(prevRating.Score),
		CountDelta: -1,
		ID:         eventID,
	}); err != nil {
		return err
	}

	event, err := q.GetEvent(ctx, eventID)
	if err == nil {
		if event.VenueID.Valid {
			_ = q.RecalculateVenueRatingFromEvents(ctx, event.VenueID.UUID)
		}
		_ = q.RecalculateEventArtistsRatingFromEvents(ctx, eventID)
	}

	return tx.Commit()
}

func (s *EventService) PutEventAction(ctx context.Context, userID, eventID uuid.UUID, status int32) error {
	if s.db == nil {
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

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	q := s.repo.WithTx(tx)

	// '참가' 상태(status=2)에서 해제(status=0)하거나 다른 상태로 변경 시 평점도 삭제
	if status != 2 {
		prevRating, err := q.GetUserRatingForEvent(ctx, repository.GetUserRatingForEventParams{
			UserID:  userID,
			EventID: eventID,
		})
		if err == nil {
			if err := q.DeleteUserEventRating(ctx, repository.DeleteUserEventRatingParams{
				UserID:  userID,
				EventID: eventID,
			}); err != nil {
				return err
			}

			if err := q.UpdateEventRating(ctx, repository.UpdateEventRatingParams{
				ScoreDelta: -float64(prevRating.Score),
				CountDelta: -1,
				ID:         eventID,
			}); err != nil {
				return err
			}

			event, err := q.GetEvent(ctx, eventID)
			if err == nil {
				if event.VenueID.Valid {
					_ = q.RecalculateVenueRatingFromEvents(ctx, event.VenueID.UUID)
				}
				_ = q.RecalculateEventArtistsRatingFromEvents(ctx, eventID)
			}
		}
	}

	if status == 0 {
		if err := q.DeleteUserEventAction(ctx, repository.DeleteUserEventActionParams{
			UserID:  userID,
			EventID: eventID,
		}); err != nil {
			return err
		}
	} else {
		if err := q.UpsertUserEventAction(ctx, repository.UpsertUserEventActionParams{
			UserID:  userID,
			EventID: eventID,
			Status:  status,
		}); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *EventService) GetEventAttendees(ctx context.Context, viewerID, eventID uuid.UUID, limit, offset int32) ([]repository.GetEventAttendeesRow, error) {
	return s.repo.GetEventAttendees(ctx, repository.GetEventAttendeesParams{
		EventID:   eventID,
		BlockerID: viewerID,
		Limit:     limit,
		Offset:    offset,
	})
}
