package handler

import (
	"encoding/json"
	"log"
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

	err := s.services.Auth.Signup(r.Context(), string(req.Email), req.Nickname, req.Password)
	if err != nil {
		log.Printf("Signup error: %v", err)
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

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "인증 코드가 이메일로 발송되었습니다.",
	})
}

// PostAuthSignupVerify implements the email verification endpoint
func (s *Server) PostAuthSignupVerify(w http.ResponseWriter, r *http.Request) {
	var req PostAuthSignupVerifyJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tokenResp, err := s.services.Auth.VerifyEmail(r.Context(), string(req.Email), req.Code)
	if err != nil {
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	setRefreshTokenCookie(w, tokenResp.RefreshToken)
	RespondJSON(w, http.StatusOK, tokenResp)
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

// PostAuthGoogle implements the POST /auth/google endpoint
func (s *Server) PostAuthGoogle(w http.ResponseWriter, r *http.Request) {
	var req PostAuthGoogleJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tokenResp, err := s.services.Auth.GoogleLogin(r.Context(), req.IdToken, true)
	if err != nil {
		RespondError(w, http.StatusUnauthorized, "Invalid Google token")
		return
	}

	setRefreshTokenCookie(w, tokenResp.RefreshToken)
	RespondJSON(w, http.StatusOK, tokenResp)
}

// PostAuthLogout implements the POST /auth/logout endpoint
func (s *Server) PostAuthLogout(w http.ResponseWriter, r *http.Request, params PostAuthLogoutParams) {
	// Clear the refresh token cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "refreshToken",
		Value:    "",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})

	// We don't have server-side logout currently, just clear the cookie.

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}
