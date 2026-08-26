package handler

import (
	"net/http"

	"github.com/google/uuid"
)

// GetArtists implements the GET /artists endpoint
func (s *Server) GetArtists(w http.ResponseWriter, r *http.Request, params GetArtistsParams) {
	// Extract query params (default values)
	limit := int32(50)
	status := ""
	if params.Status != nil {
		status = string(*params.Status)
	}
	nameKeyword := ""
	if params.Query != nil {
		nameKeyword = *params.Query
	}

	// For cursor, we'll use a nil UUID since it's not in the openapi spec yet
	cursor := uuid.Nil

	artists, err := s.services.Artist.ListArtists(r.Context(), limit, status, nameKeyword, cursor)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve artists")
		return
	}

	// Map DB models to API models (if necessary, or just return as is for now)
	RespondJSON(w, http.StatusOK, artists)
}

// GetArtistsArtistId implements the GET /artists/{artistId} endpoint
func (s *Server) GetArtistsArtistId(w http.ResponseWriter, r *http.Request, artistId uuid.UUID) {
	artist, err := s.services.Artist.GetArtist(r.Context(), artistId)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Artist not found")
		return
	}

	RespondJSON(w, http.StatusOK, artist)
}
