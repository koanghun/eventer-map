package handler

import (
	"net/http"

	"eventer-map-backend/internal/middleware"
	"github.com/google/uuid"
)

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
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve venues")
		return
	}

	RespondJSON(w, http.StatusOK, venues)
}

// GetVenuesVenueId implements the GET /venues/{venueId} endpoint
func (s *Server) GetVenuesVenueId(w http.ResponseWriter, r *http.Request, venueId uuid.UUID) {
	venue, err := s.services.Venue.GetVenue(r.Context(), venueId)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Venue not found")
		return
	}

	RespondJSON(w, http.StatusOK, venue)
}

// PostVenuesVenueIdRate implements the POST /venues/{venueId}/rate endpoint
func (s *Server) PostVenuesVenueIdRate(w http.ResponseWriter, r *http.Request, venueId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var reqBody struct {
		Score int32 `json:"score"`
	}
	if err := ParseJSON(r, &reqBody); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if reqBody.Score != 1 && reqBody.Score != -1 {
		RespondError(w, http.StatusBadRequest, "score must be 1 or -1")
		return
	}

	updatedVenue, err := s.services.Venue.RateVenue(r.Context(), myID, venueId, reqBody.Score)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondJSON(w, http.StatusOK, updatedVenue)
}
