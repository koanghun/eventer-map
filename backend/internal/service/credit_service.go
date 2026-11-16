package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
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
	SustainedTrustDuration       = 0
	ModificationRequestTTL       = 7 * 24 * time.Hour

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
	ErrDuplicateModification       = errors.New("identical modification request already exists")
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
	_ = s.repo.DeleteExpiredModificationRequests(ctx, time.Now().UTC().Add(-ModificationRequestTTL))
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

func toStringSlice(raw interface{}) ([]string, bool) {
	switch v := raw.(type) {
	case []string:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if trimmed := strings.TrimSpace(item); trimmed != "" {
				out = append(out, trimmed)
			}
		}
		return out, true
	case []interface{}:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				if trimmed := strings.TrimSpace(s); trimmed != "" {
					out = append(out, trimmed)
				}
			}
		}
		return out, true
	default:
		return nil, false
	}
}

func toFloat64Value(raw interface{}) (float64, bool) {
	switch v := raw.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	default:
		return 0, false
	}
}

func toPositiveInt32(raw interface{}) (int32, bool) {
	f, ok := toFloat64Value(raw)
	if !ok || f <= 0 {
		return 0, false
	}
	return int32(f), true
}

// splitProposedDataFields splits a modification payload into independent field-level modification payloads.
func splitProposedDataFields(entityType string, data map[string]interface{}) []map[string]interface{} {
	if len(data) == 0 {
		return nil
	}

	var items []map[string]interface{}
	switch entityType {
	case "EVENT":
		if v, ok := data["title"].(string); ok && strings.TrimSpace(v) != "" {
			items = append(items, map[string]interface{}{"title": strings.TrimSpace(v)})
		}
		if v, ok := data["date"].(string); ok && strings.TrimSpace(v) != "" {
			items = append(items, map[string]interface{}{"date": strings.TrimSpace(v)})
		}
		if v, ok := data["openingTime"].(string); ok {
			items = append(items, map[string]interface{}{"openingTime": strings.TrimSpace(v)})
		}
		if v, ok := data["startTime"].(string); ok {
			items = append(items, map[string]interface{}{"startTime": strings.TrimSpace(v)})
		}
		if v, ok := data["endTime"].(string); ok {
			items = append(items, map[string]interface{}{"endTime": strings.TrimSpace(v)})
		}
		if v, ok := data["venueId"].(string); ok && strings.TrimSpace(v) != "" {
			item := map[string]interface{}{"venueId": strings.TrimSpace(v)}
			if vn, ok := data["venueName"].(string); ok && strings.TrimSpace(vn) != "" {
				item["venueName"] = strings.TrimSpace(vn)
			}
			items = append(items, item)
		}
		if rawArtistIDs, exists := data["artistIds"]; exists {
			if ids, ok := toStringSlice(rawArtistIDs); ok {
				item := map[string]interface{}{"artistIds": ids}
				if names, ok := toStringSlice(data["artistNames"]); ok && len(names) > 0 {
					item["artistNames"] = names
				}
				items = append(items, item)
			}
		}
		if rawLinks, exists := data["relatedLinks"]; exists {
			if links, ok := toStringSlice(rawLinks); ok {
				items = append(items, map[string]interface{}{"relatedLinks": links})
			}
		}
	case "ARTIST":
		if v, ok := data["officialName"].(string); ok && strings.TrimSpace(v) != "" {
			items = append(items, map[string]interface{}{"officialName": strings.TrimSpace(v)})
		}
		if v, ok := data["hiragana"].(string); ok {
			items = append(items, map[string]interface{}{"hiragana": strings.TrimSpace(v)})
		}
		if v, ok := data["disambiguation"].(string); ok {
			items = append(items, map[string]interface{}{"disambiguation": strings.TrimSpace(v)})
		}
		if v, ok := data["gender"].(string); ok && (v == "MALE" || v == "FEMALE") {
			items = append(items, map[string]interface{}{"gender": v})
		}
	case "VENUE":
		if v, ok := data["officialName"].(string); ok && strings.TrimSpace(v) != "" {
			items = append(items, map[string]interface{}{"officialName": strings.TrimSpace(v)})
		}
		if v, ok := data["address"].(string); ok {
			items = append(items, map[string]interface{}{"address": strings.TrimSpace(v)})
		}
		if capVal, ok := toPositiveInt32(data["capacity"]); ok {
			items = append(items, map[string]interface{}{"capacity": capVal})
		}
		coordItem := map[string]interface{}{}
		if lat, ok := toFloat64Value(data["latitude"]); ok {
			coordItem["latitude"] = lat
		}
		if lng, ok := toFloat64Value(data["longitude"]); ok {
			coordItem["longitude"] = lng
		}
		if len(coordItem) > 0 {
			items = append(items, coordItem)
		}
		if rawLinks, exists := data["relatedLinks"]; exists {
			if links, ok := toStringSlice(rawLinks); ok {
				items = append(items, map[string]interface{}{"relatedLinks": links})
			}
		}
	}
	return items
}

func canonicalFieldSignature(item map[string]interface{}) string {
	normalized := make(map[string]interface{}, len(item))
	for k, v := range item {
		if k == "venueName" || k == "artistNames" {
			continue
		}
		switch k {
		case "artistIds":
			if ids, ok := toStringSlice(v); ok {
				sorted := make([]string, len(ids))
				copy(sorted, ids)
				sort.Strings(sorted)
				normalized[k] = sorted
			} else {
				normalized[k] = v
			}
		case "relatedLinks":
			if links, ok := toStringSlice(v); ok {
				normalized[k] = links
			} else {
				normalized[k] = v
			}
		case "capacity":
			if capVal, ok := toPositiveInt32(v); ok {
				normalized[k] = capVal
			} else {
				normalized[k] = v
			}
		case "latitude", "longitude":
			if f, ok := toFloat64Value(v); ok {
				normalized[k] = f
			} else {
				normalized[k] = v
			}
		default:
			if s, ok := v.(string); ok {
				normalized[k] = strings.TrimSpace(s)
			} else {
				normalized[k] = v
			}
		}
	}
	raw, err := json.Marshal(normalized)
	if err != nil {
		return ""
	}
	return string(raw)
}

func filterNonDuplicateFieldItems(candidateItems []map[string]interface{}, existingRawList [][]byte) []map[string]interface{} {
	seen := make(map[string]struct{}, len(existingRawList)+len(candidateItems))
	for _, raw := range existingRawList {
		var existing map[string]interface{}
		if err := json.Unmarshal(raw, &existing); err != nil {
			continue
		}
		if sig := canonicalFieldSignature(existing); sig != "" {
			seen[sig] = struct{}{}
		}
	}

	filtered := make([]map[string]interface{}, 0, len(candidateItems))
	for _, item := range candidateItems {
		sig := canonicalFieldSignature(item)
		if sig != "" {
			if _, exists := seen[sig]; exists {
				continue
			}
			seen[sig] = struct{}{}
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func enrichFieldModificationLabels(ctx context.Context, q *repository.Queries, entityType string, items []map[string]interface{}) {
	if q == nil || entityType != "EVENT" {
		return
	}
	for _, item := range items {
		if venueIDStr, ok := item["venueId"].(string); ok {
			if _, hasName := item["venueName"].(string); !hasName {
				if vid, err := uuid.Parse(venueIDStr); err == nil && vid != uuid.Nil {
					if v, err := q.GetVenue(ctx, vid); err == nil {
						item["venueName"] = v.OfficialName
					}
				}
			}
		}
		if ids, ok := item["artistIds"].([]string); ok {
			if _, hasNames := item["artistNames"]; !hasNames && len(ids) > 0 {
				names := make([]string, 0, len(ids))
				for _, idStr := range ids {
					if aid, err := uuid.Parse(idStr); err == nil && aid != uuid.Nil {
						if a, err := q.GetArtist(ctx, aid); err == nil {
							names = append(names, a.OfficialName)
						}
					}
				}
				if len(names) > 0 {
					item["artistNames"] = names
				}
			}
		}
	}
}

func (s *CreditService) CreateModificationRequest(ctx context.Context, input CreateModificationRequestInput) (*ModificationRequestDetail, error) {
	user, err := s.ensureActiveUser(ctx, input.AuthorID)
	if err != nil {
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

	items := splitProposedDataFields(input.EntityType, input.ProposedData)
	if len(items) == 0 {
		return nil, ErrEmptyModification
	}

	s.MaybeProcessSustainedLifecycle(ctx)

	trimmedReason := strings.TrimSpace(input.Reason)
	expiredCutoff := time.Now().UTC().Add(-ModificationRequestTTL)
	createAll := func(q *repository.Queries) ([]repository.ModificationRequest, error) {
		_ = q.DeleteExpiredModificationRequests(ctx, expiredCutoff)

		existingRows, err := q.ListModificationRequestsByEntity(ctx, repository.ListModificationRequestsByEntityParams{
			ViewerID:   input.AuthorID,
			EntityType: input.EntityType,
			EntityID:   input.EntityID,
			Status:     "PENDING",
		})
		if err != nil {
			return nil, err
		}
		existingRawList := make([][]byte, 0, len(existingRows))
		for _, r := range existingRows {
			existingRawList = append(existingRawList, r.ProposedData)
		}
		itemsToCreate := filterNonDuplicateFieldItems(items, existingRawList)
		if len(itemsToCreate) == 0 {
			return nil, ErrDuplicateModification
		}

		enrichFieldModificationLabels(ctx, q, input.EntityType, itemsToCreate)

		created := make([]repository.ModificationRequest, 0, len(itemsToCreate))
		for _, item := range itemsToCreate {
			raw, err := json.Marshal(item)
			if err != nil {
				return nil, err
			}
			mr, err := q.CreateModificationRequest(ctx, repository.CreateModificationRequestParams{
				EntityType:   input.EntityType,
				EntityID:     input.EntityID,
				AuthorID:     uuid.NullUUID{UUID: input.AuthorID, Valid: true},
				ProposedData: raw,
				Reason:       trimmedReason,
			})
			if err != nil {
				return nil, err
			}
			created = append(created, mr)
		}
		return created, nil
	}

	var createdList []repository.ModificationRequest
	if s.db != nil {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()
		createdList, err = createAll(s.repo.WithTx(tx))
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
	} else {
		var err error
		createdList, err = createAll(s.repo)
		if err != nil {
			return nil, err
		}
	}

	first := createdList[0]
	row, err := s.repo.GetModificationRequest(ctx, first.ID)
	if err != nil {
		authorName := user.DisplayName
		return mapModificationRequestToDetail(first, &authorName, 0), nil
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
		if err != nil {
			return err
		}
		if updated.Status == "PENDING" && updated.TrustCount >= MinTrustVotes {
			if updated.TrustScore >= ApplyTrustThreshold {
				if err := applyModificationWithQueries(ctx, q, updated); err != nil {
					return err
				}
				if err := q.DeleteModificationRequest(ctx, requestID); err != nil {
					return err
				}
				now := time.Now().UTC()
				updated.Status = "APPLIED"
				updated.HighTrustSince = sql.NullTime{}
				updated.LowTrustSince = sql.NullTime{}
				updated.ResolvedAt = sql.NullTime{Time: now, Valid: true}
			} else if updated.TrustScore <= RejectTrustThreshold {
				if err := q.DeleteModificationRequest(ctx, requestID); err != nil {
					return err
				}
			}
		}
		return nil
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
	mr := modificationRequestFromGetRow(reqRow)
	if err := s.applyModificationRequest(ctx, mr); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	mr.Status = "APPLIED"
	mr.HighTrustSince = sql.NullTime{}
	mr.LowTrustSince = sql.NullTime{}
	mr.ResolvedAt = sql.NullTime{Time: now, Valid: true}
	var authorName *string
	if reqRow.AuthorDisplayName.Valid {
		authorName = &reqRow.AuthorDisplayName.String
	}
	return mapModificationRequestToDetail(mr, authorName, 0), nil
}

func applyModificationWithQueries(ctx context.Context, q *repository.Queries, req repository.ModificationRequest) error {
	var data map[string]interface{}
	if err := json.Unmarshal(req.ProposedData, &data); err != nil {
		return err
	}
	switch req.EntityType {
	case "EVENT":
		return applyEventModification(ctx, q, req.EntityID, data)
	case "ARTIST":
		return applyArtistModification(ctx, q, req.EntityID, data)
	case "VENUE":
		return applyVenueModification(ctx, q, req.EntityID, data)
	default:
		return ErrInvalidEntityType
	}
}

func (s *CreditService) applyModificationRequest(ctx context.Context, req repository.ModificationRequest) error {
	run := func(q *repository.Queries) error {
		if err := applyModificationWithQueries(ctx, q, req); err != nil {
			return err
		}
		return q.DeleteModificationRequest(ctx, req.ID)
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

func parseEventFieldTime(raw string, year int, month time.Month, day int, loc *time.Location) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t, nil
	}
	if parsed, err := time.Parse("15:04", raw); err == nil {
		return time.Date(year, month, day, parsed.Hour(), parsed.Minute(), 0, 0, loc), nil
	}
	return time.Time{}, errors.New("invalid time format")
}

func applyEventModification(ctx context.Context, q *repository.Queries, eventID uuid.UUID, data map[string]interface{}) error {
	ev, err := q.GetEvent(ctx, eventID)
	if err != nil {
		return err
	}

	jst := time.FixedZone("UTC+9", 9*60*60)
	baseTime := ev.StartTime.In(jst)
	if baseTime.IsZero() && ev.OpeningTime.Valid {
		baseTime = ev.OpeningTime.Time.In(jst)
	}
	baseYear, baseMonth, baseDay := baseTime.Date()

	params := repository.UpdateEventParams{ID: eventID}
	if v, ok := data["title"].(string); ok && strings.TrimSpace(v) != "" {
		params.Title = sql.NullString{String: strings.TrimSpace(v), Valid: true}
	}

	var venueChanged bool
	if v, ok := data["venueId"].(string); ok {
		if id, err := uuid.Parse(v); err == nil && id != uuid.Nil {
			params.VenueID = uuid.NullUUID{UUID: id, Valid: true}
			venueChanged = !ev.VenueID.Valid || ev.VenueID.UUID != id
		}
	}

	if v, ok := data["date"].(string); ok && strings.TrimSpace(v) != "" {
		if newDate, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(v), jst); err == nil {
			baseYear, baseMonth, baseDay = newDate.Date()

			oldStartJST := ev.StartTime.In(jst)
			oldStartDay := time.Date(oldStartJST.Year(), oldStartJST.Month(), oldStartJST.Day(), 0, 0, 0, 0, jst)
			newStart := time.Date(baseYear, baseMonth, baseDay, oldStartJST.Hour(), oldStartJST.Minute(), oldStartJST.Second(), 0, jst)
			params.StartTime = sql.NullTime{Time: newStart, Valid: true}

			oldEndJST := ev.EndTime.In(jst)
			oldEndDay := time.Date(oldEndJST.Year(), oldEndJST.Month(), oldEndJST.Day(), 0, 0, 0, 0, jst)
			dayOffset := int(oldEndDay.Sub(oldStartDay) / (24 * time.Hour))
			if dayOffset < 0 {
				dayOffset = 0
			}
			newEnd := time.Date(baseYear, baseMonth, baseDay, oldEndJST.Hour(), oldEndJST.Minute(), oldEndJST.Second(), 0, jst).AddDate(0, 0, dayOffset)
			params.EndTime = sql.NullTime{Time: newEnd, Valid: true}

			if ev.OpeningTime.Valid && !ev.OpeningTime.Time.IsZero() {
				oldOpenJST := ev.OpeningTime.Time.In(jst)
				newOpen := time.Date(baseYear, baseMonth, baseDay, oldOpenJST.Hour(), oldOpenJST.Minute(), oldOpenJST.Second(), 0, jst)
				params.OpeningTime = sql.NullTime{Time: newOpen, Valid: true}
			}
		}
	}

	if v, ok := data["openingTime"].(string); ok {
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			params.ClearOpeningTime = true
		} else if t, err := parseEventFieldTime(trimmed, baseYear, baseMonth, baseDay, jst); err == nil {
			params.OpeningTime = sql.NullTime{Time: t.Truncate(time.Minute), Valid: true}
		}
	}
	if v, ok := data["startTime"].(string); ok {
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			sentinel := time.Date(baseYear, baseMonth, baseDay, 0, 0, 59, 0, jst)
			params.StartTime = sql.NullTime{Time: sentinel, Valid: true}
		} else if t, err := parseEventFieldTime(trimmed, baseYear, baseMonth, baseDay, jst); err == nil {
			params.StartTime = sql.NullTime{Time: t.Truncate(time.Minute), Valid: true}
		}
	}
	if v, ok := data["endTime"].(string); ok {
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			sentinel := time.Date(baseYear, baseMonth, baseDay, 23, 59, 59, 0, jst)
			params.EndTime = sql.NullTime{Time: sentinel, Valid: true}
		} else if t, err := parseEventFieldTime(trimmed, baseYear, baseMonth, baseDay, jst); err == nil {
			endT := t.Truncate(time.Minute)
			refStart := ev.StartTime
			if params.StartTime.Valid {
				refStart = params.StartTime.Time
			}
			if refStart.Second() != 59 && endT.Before(refStart) {
				endT = endT.Add(24 * time.Hour)
			} else if refStart.Second() == 59 && ev.OpeningTime.Valid && ev.OpeningTime.Time.Second() != 59 && endT.Before(ev.OpeningTime.Time) {
				endT = endT.Add(24 * time.Hour)
			}
			params.EndTime = sql.NullTime{Time: endT, Valid: true}
		}
	}
	if links, ok := toStringSlice(data["relatedLinks"]); ok {
		params.RelatedLinks = links
	}

	var oldArtists []repository.Artist
	rawArtists, hasArtists := toStringSlice(data["artistIds"])
	if hasArtists {
		oldArtists, _ = q.GetArtistsForEvent(ctx, eventID)
	}

	if _, err := q.UpdateEvent(ctx, params); err != nil {
		return err
	}

	if venueChanged {
		if ev.VenueID.Valid {
			_ = q.RecalculateVenueRatingFromEvents(ctx, ev.VenueID.UUID)
		}
		if params.VenueID.Valid {
			_ = q.RecalculateVenueRatingFromEvents(ctx, params.VenueID.UUID)
		}
	}

	if hasArtists {
		if err := q.ClearArtistsFromEvent(ctx, eventID); err != nil {
			return err
		}
		for _, s := range rawArtists {
			if aid, err := uuid.Parse(s); err == nil && aid != uuid.Nil {
				if err := q.AddArtistToEvent(ctx, repository.AddArtistToEventParams{
					EventID:  eventID,
					ArtistID: aid,
				}); err != nil {
					return err
				}
			}
		}
		for _, oa := range oldArtists {
			_ = q.RecalculateArtistRatingFromEvents(ctx, oa.ID)
		}
		_ = q.RecalculateEventArtistsRatingFromEvents(ctx, eventID)
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
	if lat, ok := toFloat64Value(data["latitude"]); ok {
		params.Latitude = sql.NullFloat64{Float64: lat, Valid: true}
	}
	if lng, ok := toFloat64Value(data["longitude"]); ok {
		params.Longitude = sql.NullFloat64{Float64: lng, Valid: true}
	}
	if capVal, ok := toPositiveInt32(data["capacity"]); ok {
		params.Capacity = sql.NullInt32{Int32: capVal, Valid: true}
	}
	if links, ok := toStringSlice(data["relatedLinks"]); ok {
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
