package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"eventer-map-backend/internal/service"
)

func setRefreshTokenCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refreshToken",
		Value:    token,
		HttpOnly: true,
		Secure:   false, // Set to true in production
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
		Expires:  time.Now().Add(7 * 24 * time.Hour), // 7 days
	})
}

// PostAuthSignup implements the local signup endpoint
func (s *Server) PostAuthSignup(w http.ResponseWriter, r *http.Request) {
	var req PostAuthSignupJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tokenResp, err := s.services.Auth.Signup(r.Context(), string(req.Email), req.Nickname, req.Password)
	if err != nil {
		if err == service.ErrUserExists || err == service.ErrNicknameExists {
			RespondError(w, http.StatusConflict, err.Error())
			return
		}
		if err == service.ErrInvalidPassword {
			RespondError(w, http.StatusBadRequest, err.Error())
			return
		}
		RespondError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	setRefreshTokenCookie(w, tokenResp.RefreshToken)
	RespondJSON(w, http.StatusCreated, tokenResp)
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

	setRefreshTokenCookie(w, tokenResp.RefreshToken)
	RespondJSON(w, http.StatusOK, tokenResp)
}

// PostAuthRefresh implements the refresh token endpoint
func (s *Server) PostAuthRefresh(w http.ResponseWriter, r *http.Request, params PostAuthRefreshParams) {
	tokenResp, err := s.services.Auth.Refresh(r.Context(), params.RefreshToken)
	if err != nil {
		RespondError(w, http.StatusUnauthorized, "Invalid or expired refresh token")
		return
	}

	setRefreshTokenCookie(w, tokenResp.RefreshToken)
	RespondJSON(w, http.StatusOK, tokenResp)
}
