package handler

import (
	"net/http"

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
