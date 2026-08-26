package handler

import (
	"encoding/json"
	"net/http"

	"eventer-map-backend/internal/service"
)

// PostAuthSignup implements the local signup endpoint
func (s *Server) PostAuthSignup(w http.ResponseWriter, r *http.Request) {
	var req PostAuthSignupJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := s.services.Auth.Signup(r.Context(), string(req.Email), req.Nickname, req.Password)
	if err != nil {
		if err == service.ErrUserExists {
			RespondError(w, http.StatusConflict, err.Error())
			return
		}
		RespondError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	RespondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":           user.ID,
		"email":        user.Email.String,
		"display_name": user.DisplayName,
	})
}

// PostAuthLogin implements the local login endpoint
func (s *Server) PostAuthLogin(w http.ResponseWriter, r *http.Request) {
	var req PostAuthLoginJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tokenResp, err := s.services.Auth.Login(r.Context(), string(req.Email), req.Password)
	if err != nil {
		if err == service.ErrInvalidLogin {
			RespondError(w, http.StatusUnauthorized, err.Error())
			return
		}
		RespondError(w, http.StatusInternalServerError, "Failed to process login")
		return
	}

	RespondJSON(w, http.StatusOK, tokenResp)
}
