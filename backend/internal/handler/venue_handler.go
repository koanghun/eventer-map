package handler

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/repository"
	"eventer-map-backend/internal/service"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func mapRepositoryVenue(v *repository.Venue) Venue {
	id := openapi_types.UUID(v.ID)
	name := v.OfficialName
	addr := v.Address
	googleMapID := v.GoogleMapID
	lat := v.Latitude
	lng := v.Longitude
	st := VenueStatus(v.Status)
	ratingCount := int(v.RatingCount)

	var rating *float64
	if v.RatingCount > 0 {
		avg := v.RatingSum / float64(v.RatingCount)
		rating = &avg
	}

	var capacity *int
	if v.Capacity.Valid {
		c := int(v.Capacity.Int32)
		capacity = &c
	}

	var links *[]string
	if len(v.RelatedLinks) > 0 {
		l := v.RelatedLinks
		links = &l
	}

	var authorID *openapi_types.UUID
	if v.AuthorID.Valid {
		a := openapi_types.UUID(v.AuthorID.UUID)
		authorID = &a
	}
	creditScore := int(v.CreditScore)
	creditCount := int(v.CreditCount)
	var highCreditSince *time.Time
	if v.HighCreditSince.Valid {
		t := v.HighCreditSince.Time
		highCreditSince = &t
	}
	var lowCreditSince *time.Time
	if v.LowCreditSince.Valid {
		t := v.LowCreditSince.Time
		lowCreditSince = &t
	}

	return Venue{
		Id:              &id,
		OfficialName:    &name,
		GoogleMapId:     &googleMapID,
		Address:         &addr,
		Latitude:        &lat,
		Longitude:       &lng,
		RelatedLinks:    links,
		Capacity:        capacity,
		Rating:          rating,
		RatingCount:     &ratingCount,
		Status:          &st,
		AuthorId:        authorID,
		CreditScore:     &creditScore,
		CreditCount:     &creditCount,
		HighCreditSince: highCreditSince,
		LowCreditSince:  lowCreditSince,
	}
}

// PostVenues implements the POST /venues endpoint
func (s *Server) PostVenues(w http.ResponseWriter, r *http.Request) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var req VenueInput
	if err := ParseJSON(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	officialName := strings.TrimSpace(req.OfficialName)
	if officialName == "" {
		RespondError(w, http.StatusBadRequest, "officialName is required")
		return
	}
	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		RespondError(w, http.StatusBadRequest, "valid latitude and longitude are required")
		return
	}

	input := service.CreateVenueInput{
		OfficialName: officialName,
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		AuthorID:     myID,
	}
	if req.GoogleMapId != nil {
		input.GoogleMapID = strings.TrimSpace(*req.GoogleMapId)
	}
	if req.Address != nil {
		input.Address = strings.TrimSpace(*req.Address)
	}
	if req.RelatedLinks != nil {
		cleaned := make([]string, 0, len(*req.RelatedLinks))
		for _, link := range *req.RelatedLinks {
			if trimmed := strings.TrimSpace(link); trimmed != "" {
				cleaned = append(cleaned, trimmed)
			}
		}
		input.RelatedLinks = cleaned
	}
	if req.Capacity != nil && *req.Capacity > 0 {
		capInt32 := int32(*req.Capacity)
		input.Capacity = &capInt32
	}

	created, err := s.services.Venue.CreateVenue(r.Context(), input)
	if err != nil {
		log.Printf("[PostVenues] CreateVenue error (officialName=%q, authorID=%s): %v", input.OfficialName, input.AuthorID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to create venue")
		return
	}

	RespondJSON(w, http.StatusCreated, mapRepositoryVenue(created))
}

// GetVenuesSearch implements the GET /venues/search endpoint
func (s *Server) GetVenuesSearch(w http.ResponseWriter, r *http.Request, params GetVenuesSearchParams) {
	limit := service.DefaultVenueSearchLimit
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}

	rows, err := s.services.Venue.SearchVenues(r.Context(), params.Query, limit)
	if err != nil {
		log.Printf("[GetVenuesSearch] SearchVenues error (query=%q): %v", params.Query, err)
		RespondError(w, http.StatusInternalServerError, "Failed to search venues")
		return
	}

	summaries := make([]VenueSummary, 0, len(rows))
	for _, row := range rows {
		id := openapi_types.UUID(row.ID)
		name := row.OfficialName
		addr := row.Address
		lat := row.Latitude
		lng := row.Longitude
		status := VenueSummaryStatus(row.Status)

		var rating *float64
		if row.RatingCount > 0 {
			avg := row.RatingSum / float64(row.RatingCount)
			rating = &avg
		}

		summaries = append(summaries, VenueSummary{
			Id:           &id,
			OfficialName: &name,
			Address:      &addr,
			Latitude:     &lat,
			Longitude:    &lng,
			Rating:       rating,
			Status:       &status,
		})
	}

	RespondJSON(w, http.StatusOK, summaries)
}

// GetVenues implements the GET /venues endpoint
func (s *Server) GetVenues(w http.ResponseWriter, r *http.Request, params GetVenuesParams) {
	status := ""
	if params.Status != nil {
		status = string(*params.Status)
	}
	nameKeyword := ""
	if params.Query != nil {
		nameKeyword = *params.Query
	}

	venues, err := s.services.Venue.ListVenuesByBoundingBox(
		r.Context(),
		params.MinLat,
		params.MaxLat,
		params.MinLng,
		params.MaxLng,
		status,
		nameKeyword,
	)
	if err != nil {
		log.Printf("[GetVenues] ListVenuesByBoundingBox error: %v", err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve venues")
		return
	}

	RespondJSON(w, http.StatusOK, venues)
}

// GetVenuesVenueId implements the GET /venues/{venueId} endpoint
func (s *Server) GetVenuesVenueId(w http.ResponseWriter, r *http.Request, venueId uuid.UUID) {
	if s.services.Credit != nil {
		s.services.Credit.MaybeProcessSustainedLifecycle(r.Context())
	}
	venue, err := s.services.Venue.GetVenue(r.Context(), venueId)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Venue not found")
		return
	}

	resp := mapRepositoryVenue(venue)
	if userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID); ok && s.services.Credit != nil {
		myCredit := VenueMyCreditScore(s.services.Credit.GetUserEntityCreditVote(r.Context(), "VENUE", venueId, userID))
		resp.MyCreditScore = &myCredit
	}

	RespondJSON(w, http.StatusOK, resp)
}

// PutVenuesVenueId implements the PUT /venues/{venueId} endpoint
func (s *Server) PutVenuesVenueId(w http.ResponseWriter, r *http.Request, venueId openapi_types.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	var req VenueInput
	if err := ParseJSON(r, &req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	input := service.CreateVenueInput{
		OfficialName: strings.TrimSpace(req.OfficialName),
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		AuthorID:     myID,
	}
	if req.GoogleMapId != nil {
		input.GoogleMapID = *req.GoogleMapId
	}
	if req.Address != nil {
		input.Address = *req.Address
	}
	if req.RelatedLinks != nil {
		input.RelatedLinks = *req.RelatedLinks
	}
	if req.Capacity != nil {
		capInt32 := int32(*req.Capacity)
		input.Capacity = &capInt32
	}
	updated, err := s.services.Venue.UpdateVenue(r.Context(), uuid.UUID(venueId), input)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserBanned), errors.Is(err, service.ErrForbidden):
			RespondError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, sql.ErrNoRows):
			RespondError(w, http.StatusNotFound, "Venue not found")
		default:
			RespondError(w, http.StatusInternalServerError, "Failed to update venue")
		}
		return
	}
	RespondJSON(w, http.StatusOK, mapRepositoryVenue(updated))
}

// DeleteVenuesVenueId implements the DELETE /venues/{venueId} endpoint
func (s *Server) DeleteVenuesVenueId(w http.ResponseWriter, r *http.Request, venueId openapi_types.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.Venue.DeleteVenue(r.Context(), uuid.UUID(venueId), myID); err != nil {
		switch {
		case errors.Is(err, service.ErrUserBanned), errors.Is(err, service.ErrForbidden):
			RespondError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, service.ErrEntityInUse):
			RespondError(w, http.StatusConflict, err.Error())
		case errors.Is(err, sql.ErrNoRows):
			RespondError(w, http.StatusNotFound, "Venue not found")
		default:
			RespondError(w, http.StatusInternalServerError, "Failed to delete venue")
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PostVenuesVenueIdApprove implements the POST /venues/{venueId}/approve endpoint
func (s *Server) PostVenuesVenueIdApprove(w http.ResponseWriter, r *http.Request, venueId openapi_types.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	approved, err := s.services.Venue.ApproveVenue(r.Context(), uuid.UUID(venueId), myID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserBanned), errors.Is(err, service.ErrForbidden):
			RespondError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, sql.ErrNoRows):
			RespondError(w, http.StatusNotFound, "Venue not found")
		default:
			RespondError(w, http.StatusInternalServerError, "Failed to approve venue")
		}
		return
	}
	RespondJSON(w, http.StatusOK, mapRepositoryVenue(approved))
}
