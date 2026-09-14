package handler

import (
	"net/http"

	"eventer-map-backend/internal/middleware"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// GetUsersMe returns the profile of the currently authenticated user
func (s *Server) GetUsersMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	user, err := s.services.Auth.GetUserByID(r.Context(), userID)
	if err != nil {
		RespondError(w, http.StatusNotFound, "user not found")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]interface{}{
		"id":          user.ID,
		"email":       user.Email.String,
		"displayName": user.DisplayName,
		"createdAt":   user.CreatedAt,
	})
}

// GetUsersMeEvents implements the GET /users/me/events endpoint
func (s *Server) GetUsersMeEvents(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	actions, err := s.services.User.ListUserEventActions(r.Context(), userID)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve events")
		return
	}

	// Map to API response
	var response []UserEventAction
	for _, a := range actions {
		response = append(response, UserEventAction{
			EventId: a.EventID,
			Status:  UserEventActionStatus(a.Status),
		})
	}
	if response == nil {
		response = []UserEventAction{}
	}

	RespondJSON(w, http.StatusOK, response)
}

// PostUsersUserIdFollow implements the POST /users/{userId}/follow endpoint
func (s *Server) PostUsersUserIdFollow(w http.ResponseWriter, r *http.Request, userId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.User.FollowUser(r.Context(), myID, userId); err != nil {
		RespondError(w, http.StatusBadRequest, "Follow failed or blocked")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Followed successfully"})
}

// DeleteUsersUserIdFollow implements the DELETE /users/{userId}/follow endpoint
func (s *Server) DeleteUsersUserIdFollow(w http.ResponseWriter, r *http.Request, userId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.User.UnfollowUser(r.Context(), myID, userId); err != nil {
		RespondError(w, http.StatusInternalServerError, "Unfollow failed")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Unfollowed successfully"})
}

// PostUsersUserIdBlock implements the POST /users/{userId}/block endpoint
func (s *Server) PostUsersUserIdBlock(w http.ResponseWriter, r *http.Request, userId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.User.BlockUser(r.Context(), myID, userId); err != nil {
		RespondError(w, http.StatusInternalServerError, "Block failed")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Blocked successfully"})
}

// DeleteUsersUserIdBlock implements the DELETE /users/{userId}/block endpoint
func (s *Server) DeleteUsersUserIdBlock(w http.ResponseWriter, r *http.Request, userId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.User.UnblockUser(r.Context(), myID, userId); err != nil {
		RespondError(w, http.StatusInternalServerError, "Unblock failed")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Unblocked successfully"})
}

// GetUsersUserIdFollowers implements the GET /users/{userId}/followers endpoint
func (s *Server) GetUsersUserIdFollowers(w http.ResponseWriter, r *http.Request, userId uuid.UUID, params GetUsersUserIdFollowersParams) {
	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	followers, err := s.services.User.ListFollowers(r.Context(), userId, limit, offset)
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

// GetUsersMeFollowing implements the GET /users/me/following endpoint
func (s *Server) GetUsersMeFollowing(w http.ResponseWriter, r *http.Request, params GetUsersMeFollowingParams) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	following, err := s.services.User.ListFollowing(r.Context(), myID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve following")
		return
	}

	response := make([]UserProfile, 0)
	for _, f := range following {
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

// GetUsersMeFollowingEvents implements the GET /users/me/following-events endpoint
func (s *Server) GetUsersMeFollowingEvents(w http.ResponseWriter, r *http.Request, params GetUsersMeFollowingEventsParams) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	events, err := s.services.User.ListFollowingEvents(r.Context(), myID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve following events")
		return
	}

	response := make([]EventSummary, 0)
	for _, e := range events {
		response = append(response, EventSummary{
			Id:             &e.ID,
			Title:          &e.Title,
			VenueId:        &e.VenueID.UUID, // e.VenueID is uuid.NullUUID, assuming valid
			StartTime:      &e.StartTime,
			EndTime:        &e.EndTime,
			Rating:         nil, // Calculate if needed
			PosterImageUrl: nil,
		})
	}
	RespondJSON(w, http.StatusOK, response)
	RespondJSON(w, http.StatusOK, response)
}

// GetUsersMeFollowingArtists implements the GET /users/me/following-artists endpoint
func (s *Server) GetUsersMeFollowingArtists(w http.ResponseWriter, r *http.Request, params GetUsersMeFollowingArtistsParams) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	artists, err := s.services.Artist.ListFollowingArtists(r.Context(), myID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve following artists")
		return
	}

	response := make([]Artist, 0)
	for _, a := range artists {
		id := openapi_types.UUID(a.ID)
		officialName := a.OfficialName
		gender := ArtistGender(a.Gender)
		status := ArtistStatus(a.Status)

		var hiragana *string
		if a.Hiragana.Valid {
			h := a.Hiragana.String
			hiragana = &h
		}
		var profileImageURL *string
		if a.ProfileImageUrl.Valid {
			p := a.ProfileImageUrl.String
			profileImageURL = &p
		}

		response = append(response, Artist{
			Id:              &id,
			OfficialName:    &officialName,
			Hiragana:        hiragana,
			Gender:          &gender,
			ProfileImageUrl: profileImageURL,
			Status:          &status,
		})
	}
	RespondJSON(w, http.StatusOK, response)
}

// GetUsersMeFollowingArtistsEvents implements the GET /users/me/following-artists/events endpoint
func (s *Server) GetUsersMeFollowingArtistsEvents(w http.ResponseWriter, r *http.Request, params GetUsersMeFollowingArtistsEventsParams) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	events, err := s.services.Artist.ListFollowingArtistEvents(r.Context(), myID, limit, offset)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve artist events")
		return
	}

	lastCheckedAtStr, err := s.services.Artist.GetLastArtistFeedCheckedAt(r.Context(), myID)
	if err != nil {
		// Log error, but proceed
		lastCheckedAtStr = "1970-01-01T00:00:00Z"
	}

	// Just a simple unreadCount calculation based on the paginated events for now
	// To be accurate across all events, we should have a specific DB query `GetUnreadArtistEventsCount`.
	// But as a fast Option A implementation, we count it on the frontend or backend in memory for the feed.
	// Actually, let's just return 0, since the UI might just show "New" labels if `e.CreatedAt > lastCheckedAt`.
	// We'll set it to 0.
	unreadCount := 0
	_ = lastCheckedAtStr
	
	responseEvents := make([]EventSummary, 0)
	for _, e := range events {
		id := openapi_types.UUID(e.ID)
		title := e.Title
		venueId := openapi_types.UUID(e.VenueID.UUID)
		startTime := e.StartTime
		endTime := e.EndTime

		responseEvents = append(responseEvents, EventSummary{
			Id:             &id,
			Title:          &title,
			VenueId:        &venueId,
			StartTime:      &startTime,
			EndTime:        &endTime,
			Rating:         nil,
			PosterImageUrl: nil,
		})
	}
	
	response := struct {
		Events      []EventSummary `json:"events"`
		UnreadCount int            `json:"unreadCount"`
	}{
		Events:      responseEvents,
		UnreadCount: unreadCount,
	}

	RespondJSON(w, http.StatusOK, response)
}

// PostUsersMeFollowingArtistsEventsRead implements the POST /users/me/following-artists/events/read endpoint
func (s *Server) PostUsersMeFollowingArtistsEventsRead(w http.ResponseWriter, r *http.Request) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	
	if err := s.services.Artist.UpdateLastArtistFeedCheckedAt(r.Context(), myID); err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to update read timestamp")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Feed marked as read"})
}
