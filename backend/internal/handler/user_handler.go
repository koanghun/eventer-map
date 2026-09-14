package handler

import (
	"net/http"

	"eventer-map-backend/internal/middleware"
	"github.com/google/uuid"
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
