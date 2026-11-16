package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"sync/atomic"
	"time"

	"eventer-map-backend/internal/repository"

	"github.com/google/uuid"
)

const (
	MinCreditVotes          int32 = 5
	PromoteScoreThreshold   int32 = 5
	DeleteScoreThreshold    int32 = -5
	SustainedCreditDuration       = 24 * time.Hour

	MinTrustVotes          int32 = 5
	ApplyTrustThreshold    int32 = 5
	RejectTrustThreshold   int32 = -5
	SustainedTrustDuration       = 24 * time.Hour

	lifecycleCheckInterval = 30 * time.Second
)

var (
	ErrInvalidCreditScore          = errors.New("score must be -1, 0, or 1")
	ErrSelfVoteNotAllowed          = errors.New("author cannot vote on their own submission")
	ErrEntityNotOfficial           = errors.New("modification requests are only allowed on approved entities")
	ErrModificationAlreadyResolved = errors.New("modification request is already resolved")
	ErrForbidden                   = errors.New("forbidden")
	ErrInvalidEntityType           = errors.New("entityType must be EVENT, ARTIST, or VENUE")
	ErrEmptyModification           = errors.New("proposedData must not be empty")
)

type CreditVoteResult struct {
	ID              uuid.UUID
	Status          string
	CreditScore     int32
	CreditCount     int32
	MyCreditScore   int32
	HighCreditSince *time.Time
	LowCreditSince  *time.Time
}

type CreateModificationRequestInput struct {
	EntityType   string
	EntityID     uuid.UUID
	AuthorID     uuid.UUID
	ProposedData map[string]interface{}
	Reason       string
}

type ModificationRequestDetail struct {
	ID                uuid.UUID
	EntityType        string
	EntityID          uuid.UUID
	AuthorID          *uuid.UUID
	AuthorDisplayName *string
	ProposedData      map[string]interface{}
	Reason            string
	Status            string
	TrustScore        int32
	TrustCount        int32
	MyTrustScore      int32
	HighTrustSince    *time.Time
	LowTrustSince     *time.Time
	ResolvedAt        *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type CreditService struct {
	repo             *repository.Queries
	db               *sql.DB
	lastLifecycleRun atomic.Int64
}

func NewCreditService(repo *repository.Queries, db *sql.DB) *CreditService {
	return &CreditService{
		repo: repo,
		db:   db,
	}
}

// MaybeProcessSustainedLifecycle runs sustained promotion/deletion checks at most once per lifecycleCheckInterval.
func (s *CreditService) MaybeProcessSustainedLifecycle(ctx context.Context) {
	if s == nil || s.repo == nil {
		return
	}
	now := time.Now().UnixNano()
	prev := s.lastLifecycleRun.Load()
	if now-prev < int64(lifecycleCheckInterval) {
		return
	}
	if !s.lastLifecycleRun.CompareAndSwap(prev, now) {
		return
	}
	_ = s.ProcessSustainedLifecycle(ctx)
}

// ProcessSustainedLifecycle promotes/deletes PENDING entities and applies/deletes PENDING modification requests
// whose sustained score window has elapsed.
func (s *CreditService) ProcessSustainedLifecycle(ctx context.Context) error {
	if s == nil || s.repo == nil {
		return nil
	}
	creditCutoff := sql.NullTime{Time: time.Now().UTC().Add(-SustainedCreditDuration), Valid: true}
	_ = s.repo.PromoteSustainedEvents(ctx, creditCutoff)
	_ = s.repo.DeleteSustainedLowCreditEvents(ctx, creditCutoff)
	_ = s.repo.PromoteSustainedArtists(ctx, creditCutoff)
	_ = s.repo.DeleteSustainedLowCreditArtists(ctx, creditCutoff)
	_ = s.repo.PromoteSustainedVenues(ctx, creditCutoff)
	_ = s.repo.DeleteSustainedLowCreditVenues(ctx, creditCutoff)

	trustCutoff := sql.NullTime{Time: time.Now().UTC().Add(-SustainedTrustDuration), Valid: true}
	if highTrustReqs, err := s.repo.ListSustainedHighTrustModificationRequests(ctx, trustCutoff); err == nil {
		for _, req := range highTrustReqs {
			_ = s.applyModificationRequest(ctx, req)
		}
	}
	_ = s.repo.DeleteSustainedLowTrustModificationRequests(ctx, trustCutoff)
	return nil
}

func (s *CreditService) ensureActiveUser(ctx context.Context, userID uuid.UUID) (repository.User, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return repository.User{}, err
	}
	if user.IsBanned {
		return repository.User{}, ErrUserBanned
	}
	return user, nil
}

func (s *CreditService) VoteEntityCredit(ctx context.Context, entityType string, entityID, userID uuid.UUID, score int32) (*CreditVoteResult, error) {
	if score != -1 && score != 0 && score != 1 {
		return nil, ErrInvalidCreditScore
	}
	if _, err := s.ensureActiveUser(ctx, userID); err != nil {
		return nil, err
	}

	var authorID uuid.NullUUID
	switch entityType {
	case "EVENT":
		ev, err := s.repo.GetEvent(ctx, entityID)
		if err != nil {
			return nil, err
		}
		authorID = ev.AuthorID
	case "ARTIST":
		ar, err := s.repo.GetArtist(ctx, entityID)
		if err != nil {
			return nil, err
		}
		authorID = ar.AuthorID
	case "VENUE":
		ve, err := s.repo.GetVenue(ctx, entityID)
		if err != nil {
			return nil, err
		}
		authorID = ve.AuthorID
	default:
		return nil, ErrInvalidEntityType
	}

	if authorID.Valid && authorID.UUID == userID {
		return nil, ErrSelfVoteNotAllowed
	}

	s.MaybeProcessSustainedLifecycle(ctx)

	res := &CreditVoteResult{
		MyCreditScore: score,
	}
	setCreditState := func(id uuid.UUID, status string, creditScore, creditCount int32, highCreditSince, lowCreditSince sql.NullTime) {
		res.ID = id
		res.Status = status
		res.CreditScore = creditScore
		res.CreditCount = creditCount
		if highCreditSince.Valid {
			t := highCreditSince.Time
			res.HighCreditSince = &t
		}
		if lowCreditSince.Valid {
			t := lowCreditSince.Time
			res.LowCreditSince = &t
		}
	}

	runVote := func(q *repository.Queries) error {
		var err error
		switch entityType {
		case "EVENT":
			if score == 0 {
				err = q.DeleteEventCreditVote(ctx, repository.DeleteEventCreditVoteParams{
					UserID:  userID,
					EventID: entityID,
				})
			} else {
				err = q.UpsertEventCreditVote(ctx, repository.UpsertEventCreditVoteParams{
					UserID:  userID,
					EventID: entityID,
					Score:   score,
				})
			}
			if err != nil {
				return err
			}
			state, err := q.RecalculateEventCredit(ctx, repository.RecalculateEventCreditParams{
				ID:               entityID,
				MinVotes:         MinCreditVotes,
				PromoteThreshold: PromoteScoreThreshold,
				DeleteThreshold:  DeleteScoreThreshold,
			})
			if err != nil {
				return err
			}
			setCreditState(state.ID, state.Status, state.CreditScore, state.CreditCount, state.HighCreditSince, state.LowCreditSince)
		case "ARTIST":
			if score == 0 {
				err = q.DeleteArtistCreditVote(ctx, repository.DeleteArtistCreditVoteParams{
					UserID:   userID,
					ArtistID: entityID,
				})
			} else {
				err = q.UpsertArtistCreditVote(ctx, repository.UpsertArtistCreditVoteParams{
					UserID:   userID,
					ArtistID: entityID,
					Score:    score,
				})
			}
			if err != nil {
				return err
			}
			state, err := q.RecalculateArtistCredit(ctx, repository.RecalculateArtistCreditParams{
				ID:               entityID,
				MinVotes:         MinCreditVotes,
				PromoteThreshold: PromoteScoreThreshold,
				DeleteThreshold:  DeleteScoreThreshold,
			})
			if err != nil {
				return err
			}
			setCreditState(state.ID, state.Status, state.CreditScore, state.CreditCount, state.HighCreditSince, state.LowCreditSince)
		case "VENUE":
			if score == 0 {
				err = q.DeleteVenueCreditVote(ctx, repository.DeleteVenueCreditVoteParams{
					UserID:  userID,
					VenueID: entityID,
				})
			} else {
				err = q.UpsertVenueCreditVote(ctx, repository.UpsertVenueCreditVoteParams{
					UserID:  userID,
					VenueID: entityID,
					Score:   score,
				})
			}
			if err != nil {
				return err
			}
			state, err := q.RecalculateVenueCredit(ctx, repository.RecalculateVenueCreditParams{
				ID:               entityID,
				MinVotes:         MinCreditVotes,
				PromoteThreshold: PromoteScoreThreshold,
				DeleteThreshold:  DeleteScoreThreshold,
			})
			if err != nil {
				return err
			}
			setCreditState(state.ID, state.Status, state.CreditScore, state.CreditCount, state.HighCreditSince, state.LowCreditSince)
		}
		return nil
	}

	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()
		if err := runVote(s.repo.WithTx(tx)); err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
	} else if err := runVote(s.repo); err != nil {
		return nil, err
	}

	return res, nil
}

func (s *CreditService) GetUserEntityCreditVote(ctx context.Context, entityType string, entityID, userID uuid.UUID) int32 {
	if s == nil || s.repo == nil || userID == uuid.Nil {
		return 0
	}
	var (
		score int32
		err   error
	)
	switch entityType {
	case "EVENT":
		score, err = s.repo.GetUserEventCreditVote(ctx, repository.GetUserEventCreditVoteParams{
			UserID:  userID,
			EventID: entityID,
		})
	case "ARTIST":
		score, err = s.repo.GetUserArtistCreditVote(ctx, repository.GetUserArtistCreditVoteParams{
			UserID:   userID,
			ArtistID: entityID,
		})
	case "VENUE":
		score, err = s.repo.GetUserVenueCreditVote(ctx, repository.GetUserVenueCreditVoteParams{
			UserID:  userID,
			VenueID: entityID,
		})
	default:
		return 0
	}
	if err != nil {
		return 0
	}
	return score
}

func (s *CreditService) CreateModificationRequest(ctx context.Context, input CreateModificationRequestInput) (*ModificationRequestDetail, error) {
	if _, err := s.ensureActiveUser(ctx, input.AuthorID); err != nil {
		return nil, err
	}
	if len(input.ProposedData) == 0 {
		return nil, ErrEmptyModification
	}

	switch input.EntityType {
	case "EVENT":
		ev, err := s.repo.GetEvent(ctx, input.EntityID)
		if err != nil {
			return nil, err
		}
		if ev.Status != "APPROVED" {
			return nil, ErrEntityNotOfficial
		}
	case "ARTIST":
		ar, err := s.repo.GetArtist(ctx, input.EntityID)
		if err != nil {
			return nil, err
		}
		if ar.Status != "APPROVED" {
			return nil, ErrEntityNotOfficial
		}
	case "VENUE":
		ve, err := s.repo.GetVenue(ctx, input.EntityID)
		if err != nil {
			return nil, err
		}
		if ve.Status != "APPROVED" {
			return nil, ErrEntityNotOfficial
		}
	default:
		return nil, ErrInvalidEntityType
	}

	raw, err := json.Marshal(input.ProposedData)
	if err != nil {
		return nil, err
	}

	mr, err := s.repo.CreateModificationRequest(ctx, repository.CreateModificationRequestParams{
		EntityType:   input.EntityType,
		EntityID:     input.EntityID,
		AuthorID:     uuid.NullUUID{UUID: input.AuthorID, Valid: true},
		ProposedData: raw,
		Reason:       strings.TrimSpace(input.Reason),
	})
	if err != nil {
		return nil, err
	}

	row, err := s.repo.GetModificationRequest(ctx, mr.ID)
	if err != nil {
		return mapModificationRequestToDetail(mr, nil, 0), nil
	}
	return mapGetModificationRequestRowToDetail(row), nil
}

func (s *CreditService) ListModificationRequests(ctx context.Context, entityType string, entityID uuid.UUID, status string, viewerID uuid.UUID) ([]*ModificationRequestDetail, error) {
	if entityType != "EVENT" && entityType != "ARTIST" && entityType != "VENUE" {
		return nil, ErrInvalidEntityType
	}
	s.MaybeProcessSustainedLifecycle(ctx)

	rows, err := s.repo.ListModificationRequestsByEntity(ctx, repository.ListModificationRequestsByEntityParams{
		ViewerID:   viewerID,
		EntityType: entityType,
		EntityID:   entityID,
		Status:     status,
	})
	if err != nil {
		return nil, err
	}
	result := make([]*ModificationRequestDetail, 0, len(rows))
	for _, row := range rows {
		result = append(result, mapListModificationRequestRowToDetail(row))
	}
	return result, nil
}

func (s *CreditService) DeleteModificationRequest(ctx context.Context, requestID, userID uuid.UUID) error {
	user, err := s.ensureActiveUser(ctx, userID)
	if err != nil {
		return err
	}
	req, err := s.repo.GetModificationRequest(ctx, requestID)
	if err != nil {
		return err
	}
	if user.Role != "ADMIN" {
		if req.Status != "PENDING" || !req.AuthorID.Valid || req.AuthorID.UUID != userID {
			return ErrForbidden
		}
	}
	return s.repo.DeleteModificationRequest(ctx, requestID)
}

func (s *CreditService) VoteModificationRequestTrust(ctx context.Context, requestID, userID uuid.UUID, score int32) (*ModificationRequestDetail, error) {
	if score != -1 && score != 0 && score != 1 {
		return nil, ErrInvalidCreditScore
	}
	if _, err := s.ensureActiveUser(ctx, userID); err != nil {
		return nil, err
	}

	reqRow, err := s.repo.GetModificationRequest(ctx, requestID)
	if err != nil {
		return nil, err
	}
	if reqRow.Status != "PENDING" {
		return nil, ErrModificationAlreadyResolved
	}
	if reqRow.AuthorID.Valid && reqRow.AuthorID.UUID == userID {
		return nil, ErrSelfVoteNotAllowed
	}

	s.MaybeProcessSustainedLifecycle(ctx)

	var updated repository.ModificationRequest
	runTrustVote := func(q *repository.Queries) error {
		var err error
		if score == 0 {
			err = q.DeleteModificationRequestVote(ctx, repository.DeleteModificationRequestVoteParams{
				UserID:    userID,
				RequestID: requestID,
			})
		} else {
			err = q.UpsertModificationRequestVote(ctx, repository.UpsertModificationRequestVoteParams{
				UserID:    userID,
				RequestID: requestID,
				Score:     score,
			})
		}
		if err != nil {
			return err
		}
		updated, err = q.RecalculateModificationRequestTrust(ctx, repository.RecalculateModificationRequestTrustParams{
			ID:              requestID,
			MinVotes:        MinTrustVotes,
			ApplyThreshold:  ApplyTrustThreshold,
			RejectThreshold: RejectTrustThreshold,
		})
		return err
	}

	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()
		if err := runTrustVote(s.repo.WithTx(tx)); err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
	} else if err := runTrustVote(s.repo); err != nil {
		return nil, err
	}

	var authorName *string
	if reqRow.AuthorDisplayName.Valid {
		authorName = &reqRow.AuthorDisplayName.String
	}
	return mapModificationRequestToDetail(updated, authorName, score), nil
}

func (s *CreditService) ApplyModificationRequestByAdmin(ctx context.Context, requestID, adminUserID uuid.UUID) (*ModificationRequestDetail, error) {
	user, err := s.ensureActiveUser(ctx, adminUserID)
	if err != nil {
		return nil, err
	}
	if user.Role != "ADMIN" {
		return nil, ErrForbidden
	}
	reqRow, err := s.repo.GetModificationRequest(ctx, requestID)
	if err != nil {
		return nil, err
	}
	if reqRow.Status != "PENDING" {
		return nil, ErrModificationAlreadyResolved
	}
	if err := s.applyModificationRequest(ctx, modificationRequestFromGetRow(reqRow)); err != nil {
		return nil, err
	}
	updated, err := s.repo.GetModificationRequest(ctx, requestID)
	if err != nil {
		return nil, err
	}
	return mapGetModificationRequestRowToDetail(updated), nil
}

func (s *CreditService) applyModificationRequest(ctx context.Context, req repository.ModificationRequest) error {
	var data map[string]interface{}
	if err := json.Unmarshal(req.ProposedData, &data); err != nil {
		return err
	}

	run := func(q *repository.Queries) error {
		switch req.EntityType {
		case "EVENT":
			if err := applyEventModification(ctx, q, req.EntityID, data); err != nil {
				return err
			}
		case "ARTIST":
			if err := applyArtistModification(ctx, q, req.EntityID, data); err != nil {
				return err
			}
		case "VENUE":
			if err := applyVenueModification(ctx, q, req.EntityID, data); err != nil {
				return err
			}
		default:
			return ErrInvalidEntityType
		}
		_, err := q.MarkModificationRequestApplied(ctx, req.ID)
		return err
	}

	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer tx.Rollback()
		if err := run(s.repo.WithTx(tx)); err != nil {
			return err
		}
		return tx.Commit()
	}
	return run(s.repo)
}

func applyEventModification(ctx context.Context, q *repository.Queries, eventID uuid.UUID, data map[string]interface{}) error {
	params := repository.UpdateEventParams{ID: eventID}
	if v, ok := data["title"].(string); ok && strings.TrimSpace(v) != "" {
		params.Title = sql.NullString{String: strings.TrimSpace(v), Valid: true}
	}
	if v, ok := data["venueId"].(string); ok {
		if id, err := uuid.Parse(v); err == nil && id != uuid.Nil {
			params.VenueID = uuid.NullUUID{UUID: id, Valid: true}
		}
	}
	if v, ok := data["openingTime"].(string); ok && v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			params.OpeningTime = sql.NullTime{Time: t, Valid: true}
		}
	}
	if v, ok := data["startTime"].(string); ok && v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			params.StartTime = sql.NullTime{Time: t, Valid: true}
		}
	}
	if v, ok := data["endTime"].(string); ok && v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			params.EndTime = sql.NullTime{Time: t, Valid: true}
		}
	}
	if rawLinks, ok := data["relatedLinks"].([]interface{}); ok {
		links := make([]string, 0, len(rawLinks))
		for _, item := range rawLinks {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				links = append(links, strings.TrimSpace(s))
			}
		}
		params.RelatedLinks = links
	}
	if _, err := q.UpdateEvent(ctx, params); err != nil {
		return err
	}
	if rawArtists, ok := data["artistIds"].([]interface{}); ok {
		if err := q.ClearArtistsFromEvent(ctx, eventID); err != nil {
			return err
		}
		for _, item := range rawArtists {
			if s, ok := item.(string); ok {
				if aid, err := uuid.Parse(s); err == nil && aid != uuid.Nil {
					if err := q.AddArtistToEvent(ctx, repository.AddArtistToEventParams{
						EventID:  eventID,
						ArtistID: aid,
					}); err != nil {
						return err
					}
				}
			}
		}
	}
	return nil
}

func applyArtistModification(ctx context.Context, q *repository.Queries, artistID uuid.UUID, data map[string]interface{}) error {
	params := repository.UpdateArtistParams{ID: artistID}
	if v, ok := data["officialName"].(string); ok && strings.TrimSpace(v) != "" {
		params.OfficialName = sql.NullString{String: strings.TrimSpace(v), Valid: true}
	}
	if v, ok := data["hiragana"].(string); ok {
		params.Hiragana = sql.NullString{String: strings.TrimSpace(v), Valid: true}
	}
	if v, ok := data["disambiguation"].(string); ok {
		params.Disambiguation = sql.NullString{String: strings.TrimSpace(v), Valid: true}
	}
	if v, ok := data["gender"].(string); ok && (v == "MALE" || v == "FEMALE") {
		params.Gender = sql.NullString{String: v, Valid: true}
	}
	_, err := q.UpdateArtist(ctx, params)
	return err
}

func applyVenueModification(ctx context.Context, q *repository.Queries, venueID uuid.UUID, data map[string]interface{}) error {
	params := repository.UpdateVenueParams{ID: venueID}
	if v, ok := data["officialName"].(string); ok && strings.TrimSpace(v) != "" {
		params.OfficialName = sql.NullString{String: strings.TrimSpace(v), Valid: true}
	}
	if v, ok := data["address"].(string); ok {
		params.Address = sql.NullString{String: strings.TrimSpace(v), Valid: true}
	}
	if v, ok := data["latitude"].(float64); ok {
		params.Latitude = sql.NullFloat64{Float64: v, Valid: true}
	}
	if v, ok := data["longitude"].(float64); ok {
		params.Longitude = sql.NullFloat64{Float64: v, Valid: true}
	}
	if v, ok := data["capacity"].(float64); ok && v > 0 {
		params.Capacity = sql.NullInt32{Int32: int32(v), Valid: true}
	}
	if rawLinks, ok := data["relatedLinks"].([]interface{}); ok {
		links := make([]string, 0, len(rawLinks))
		for _, item := range rawLinks {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				links = append(links, strings.TrimSpace(s))
			}
		}
		params.RelatedLinks = links
	}
	_, err := q.UpdateVenue(ctx, params)
	return err
}

func modificationRequestFromGetRow(row repository.GetModificationRequestRow) repository.ModificationRequest {
	return repository.ModificationRequest{
		ID:             row.ID,
		EntityType:     row.EntityType,
		EntityID:       row.EntityID,
		AuthorID:       row.AuthorID,
		ProposedData:   row.ProposedData,
		Reason:         row.Reason,
		Status:         row.Status,
		TrustScore:     row.TrustScore,
		TrustCount:     row.TrustCount,
		HighTrustSince: row.HighTrustSince,
		LowTrustSince:  row.LowTrustSince,
		ResolvedAt:     row.ResolvedAt,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}
}

func mapGetModificationRequestRowToDetail(row repository.GetModificationRequestRow) *ModificationRequestDetail {
	var authorName *string
	if row.AuthorDisplayName.Valid {
		authorName = &row.AuthorDisplayName.String
	}
	return mapModificationRequestToDetail(modificationRequestFromGetRow(row), authorName, 0)
}

func mapListModificationRequestRowToDetail(row repository.ListModificationRequestsByEntityRow) *ModificationRequestDetail {
	var authorName *string
	if row.AuthorDisplayName.Valid {
		authorName = &row.AuthorDisplayName.String
	}
	return mapModificationRequestToDetail(repository.ModificationRequest{
		ID:             row.ID,
		EntityType:     row.EntityType,
		EntityID:       row.EntityID,
		AuthorID:       row.AuthorID,
		ProposedData:   row.ProposedData,
		Reason:         row.Reason,
		Status:         row.Status,
		TrustScore:     row.TrustScore,
		TrustCount:     row.TrustCount,
		HighTrustSince: row.HighTrustSince,
		LowTrustSince:  row.LowTrustSince,
		ResolvedAt:     row.ResolvedAt,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}, authorName, row.MyTrustScore)
}

func mapModificationRequestToDetail(mr repository.ModificationRequest, authorName *string, myTrustScore int32) *ModificationRequestDetail {
	proposed := map[string]interface{}{}
	if len(mr.ProposedData) > 0 {
		_ = json.Unmarshal(mr.ProposedData, &proposed)
	}
	detail := &ModificationRequestDetail{
		ID:                mr.ID,
		EntityType:        mr.EntityType,
		EntityID:          mr.EntityID,
		AuthorDisplayName: authorName,
		ProposedData:      proposed,
		Reason:            mr.Reason,
		Status:            mr.Status,
		TrustScore:        mr.TrustScore,
		TrustCount:        mr.TrustCount,
		MyTrustScore:      myTrustScore,
		CreatedAt:         mr.CreatedAt,
		UpdatedAt:         mr.UpdatedAt,
	}
	if mr.AuthorID.Valid {
		id := mr.AuthorID.UUID
		detail.AuthorID = &id
	}
	if mr.HighTrustSince.Valid {
		t := mr.HighTrustSince.Time
		detail.HighTrustSince = &t
	}
	if mr.LowTrustSince.Valid {
		t := mr.LowTrustSince.Time
		detail.LowTrustSince = &t
	}
	if mr.ResolvedAt.Valid {
		t := mr.ResolvedAt.Time
		detail.ResolvedAt = &t
	}
	return detail
}
