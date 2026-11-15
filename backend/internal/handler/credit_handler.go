package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/service"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (s *Server) handleCreditVote(w http.ResponseWriter, r *http.Request, entityType string, entityID uuid.UUID) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var body CreditVoteInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	res, err := s.services.Credit.VoteEntityCredit(r.Context(), entityType, entityID, userID, int32(body.Score))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCreditScore):
			RespondError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrUserBanned), errors.Is(err, service.ErrSelfVoteNotAllowed):
			RespondError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, sql.ErrNoRows):
			RespondError(w, http.StatusNotFound, "entity not found")
		default:
			RespondError(w, http.StatusInternalServerError, "failed to record credit vote")
		}
		return
	}

	RespondJSON(w, http.StatusOK, CreditVoteResponse{
		Id:              openapi_types.UUID(res.ID),
		Status:          res.Status,
		CreditScore:     int(res.CreditScore),
		CreditCount:     int(res.CreditCount),
		MyCreditScore:   int(res.MyCreditScore),
		HighCreditSince: res.HighCreditSince,
		LowCreditSince:  res.LowCreditSince,
	})
}

func (s *Server) PutArtistsArtistIdCredit(w http.ResponseWriter, r *http.Request, artistId openapi_types.UUID) {
	s.handleCreditVote(w, r, "ARTIST", uuid.UUID(artistId))
}

func (s *Server) PutVenuesVenueIdCredit(w http.ResponseWriter, r *http.Request, venueId openapi_types.UUID) {
	s.handleCreditVote(w, r, "VENUE", uuid.UUID(venueId))
}

func (s *Server) PutEventsEventIdCredit(w http.ResponseWriter, r *http.Request, eventId openapi_types.UUID) {
	s.handleCreditVote(w, r, "EVENT", uuid.UUID(eventId))
}

func mapModificationRequestDetailToResponse(d *service.ModificationRequestDetail) ModificationRequest {
	var authorID *openapi_types.UUID
	if d.AuthorID != nil {
		v := openapi_types.UUID(*d.AuthorID)
		authorID = &v
	}
	return ModificationRequest{
		Id:                openapi_types.UUID(d.ID),
		EntityType:        ModificationEntityType(d.EntityType),
		EntityId:          openapi_types.UUID(d.EntityID),
		AuthorId:          authorID,
		AuthorDisplayName: d.AuthorDisplayName,
		ProposedData:      d.ProposedData,
		Reason:            d.Reason,
		Status:            d.Status,
		TrustScore:        int(d.TrustScore),
		TrustCount:        int(d.TrustCount),
		MyTrustScore:      int(d.MyTrustScore),
		HighTrustSince:    d.HighTrustSince,
		LowTrustSince:     d.LowTrustSince,
		ResolvedAt:        d.ResolvedAt,
		CreatedAt:         d.CreatedAt,
		UpdatedAt:         d.UpdatedAt,
	}
}

func (s *Server) ListModificationRequests(w http.ResponseWriter, r *http.Request, params ListModificationRequestsParams) {
	var viewerID uuid.UUID
	if uid, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID); ok {
		viewerID = uid
	}
	status := ""
	if params.Status != nil {
		status = *params.Status
	}

	items, err := s.services.Credit.ListModificationRequests(
		r.Context(),
		string(params.EntityType),
		uuid.UUID(params.EntityId),
		status,
		viewerID,
	)
	if err != nil {
		if errors.Is(err, service.ErrInvalidEntityType) {
			RespondError(w, http.StatusBadRequest, err.Error())
			return
		}
		RespondError(w, http.StatusInternalServerError, "failed to list modification requests")
		return
	}

	res := make([]ModificationRequest, 0, len(items))
	for _, item := range items {
		res = append(res, mapModificationRequestDetailToResponse(item))
	}
	RespondJSON(w, http.StatusOK, ModificationRequestListResponse{Requests: res})
}

func (s *Server) CreateModificationRequest(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var body CreateModificationRequestInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	reason := ""
	if body.Reason != nil {
		reason = *body.Reason
	}

	detail, err := s.services.Credit.CreateModificationRequest(r.Context(), service.CreateModificationRequestInput{
		EntityType:   string(body.EntityType),
		EntityID:     uuid.UUID(body.EntityId),
		AuthorID:     userID,
		ProposedData: body.ProposedData,
		Reason:       reason,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidEntityType), errors.Is(err, service.ErrEmptyModification), errors.Is(err, service.ErrEntityNotOfficial):
			RespondError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrUserBanned):
			RespondError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, sql.ErrNoRows):
			RespondError(w, http.StatusNotFound, "target entity not found")
		default:
			RespondError(w, http.StatusInternalServerError, "failed to create modification request")
		}
		return
	}

	RespondJSON(w, http.StatusCreated, mapModificationRequestDetailToResponse(detail))
}

func (s *Server) DeleteModificationRequest(w http.ResponseWriter, r *http.Request, requestId openapi_types.UUID) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	err := s.services.Credit.DeleteModificationRequest(r.Context(), uuid.UUID(requestId), userID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserBanned), errors.Is(err, service.ErrForbidden):
			RespondError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, sql.ErrNoRows):
			RespondError(w, http.StatusNotFound, "modification request not found")
		default:
			RespondError(w, http.StatusInternalServerError, "failed to delete modification request")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) VoteModificationRequestTrust(w http.ResponseWriter, r *http.Request, requestId openapi_types.UUID) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var body CreditVoteInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		RespondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	detail, err := s.services.Credit.VoteModificationRequestTrust(r.Context(), uuid.UUID(requestId), userID, int32(body.Score))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCreditScore), errors.Is(err, service.ErrModificationAlreadyResolved):
			RespondError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrUserBanned), errors.Is(err, service.ErrSelfVoteNotAllowed):
			RespondError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, sql.ErrNoRows):
			RespondError(w, http.StatusNotFound, "modification request not found")
		default:
			RespondError(w, http.StatusInternalServerError, "failed to record trust vote")
		}
		return
	}

	RespondJSON(w, http.StatusOK, mapModificationRequestDetailToResponse(detail))
}

func (s *Server) ApplyModificationRequest(w http.ResponseWriter, r *http.Request, requestId openapi_types.UUID) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	detail, err := s.services.Credit.ApplyModificationRequestByAdmin(r.Context(), uuid.UUID(requestId), userID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrModificationAlreadyResolved):
			RespondError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrUserBanned), errors.Is(err, service.ErrForbidden):
			RespondError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, sql.ErrNoRows):
			RespondError(w, http.StatusNotFound, "modification request not found")
		default:
			RespondError(w, http.StatusInternalServerError, "failed to apply modification request")
		}
		return
	}

	RespondJSON(w, http.StatusOK, mapModificationRequestDetailToResponse(detail))
}
