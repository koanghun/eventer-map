package handler

import (
	"net/http"

	"eventer-map-backend/internal/middleware"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
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

// PostArtistsArtistIdFollow implements the POST /artists/{artistId}/follow endpoint
func (s *Server) PostArtistsArtistIdFollow(w http.ResponseWriter, r *http.Request, artistId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.Artist.FollowArtist(r.Context(), myID, artistId); err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to follow artist")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Followed successfully"})
}

// DeleteArtistsArtistIdFollow implements the DELETE /artists/{artistId}/follow endpoint
func (s *Server) DeleteArtistsArtistIdFollow(w http.ResponseWriter, r *http.Request, artistId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.Artist.UnfollowArtist(r.Context(), myID, artistId); err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to unfollow artist")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Unfollowed successfully"})
}

// GetArtistsArtistIdFollowers implements the GET /artists/{artistId}/followers endpoint
func (s *Server) GetArtistsArtistIdFollowers(w http.ResponseWriter, r *http.Request, artistId uuid.UUID, params GetArtistsArtistIdFollowersParams) {
	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	followers, err := s.services.Artist.ListArtistFollowers(r.Context(), artistId, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve followers")
		return
	}

	response := make([]UserProfile, 0)
	for _, f := range followers {
		id := openapi_types.UUID(f.ID)
		name := f.DisplayName
		t := f.CreatedAt
		response = append(response, UserProfile{
			Id:          &id,
			DisplayName: &name,
			CreatedAt:   &t,
		})
	}
	RespondJSON(w, http.StatusOK, response)
}
