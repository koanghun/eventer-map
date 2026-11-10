package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"eventer-map-backend/internal/service"
)

func buildRefreshTokenCookie(token string, expires time.Time, maxAge int) *http.Cookie {
	env := os.Getenv("ENV")
	isProd := env != "" && env != "local"

	sameSite := http.SameSiteLaxMode
	if strings.EqualFold(os.Getenv("COOKIE_SAMESITE"), "none") && isProd {
		sameSite = http.SameSiteNoneMode
	}

	cookie := &http.Cookie{
		Name:     "refreshToken",
		Value:    token,
		HttpOnly: true,
		Secure:   isProd,
		SameSite: sameSite,
		Path:     "/",
		Expires:  expires,
	}
	if maxAge != 0 {
		cookie.MaxAge = maxAge
	}
	if domain := os.Getenv("COOKIE_DOMAIN"); domain != "" {
		cookie.Domain = domain
	}
	return cookie
}

func setRefreshTokenCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, buildRefreshTokenCookie(token, time.Now().Add(7*24*time.Hour), 0))
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
		if err == service.ErrUserExists {
			RespondErrorCode(w, http.StatusConflict, "USER_EXISTS", err.Error())
			return
		}
		if err == service.ErrNicknameExists {
			RespondErrorCode(w, http.StatusConflict, "NICKNAME_EXISTS", err.Error())
			return
		}
		if err == service.ErrInvalidPassword {
			RespondErrorCode(w, http.StatusBadRequest, "INVALID_PASSWORD", err.Error())
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
		if err == service.ErrTooManyAttempts {
			RespondErrorCode(w, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS", err.Error())
			return
		}
		if err == service.ErrInvalidVerifyCode {
			RespondErrorCode(w, http.StatusBadRequest, "INVALID_VERIFY_CODE", err.Error())
			return
		}
		RespondError(w, http.StatusBadRequest, err.Error())
		return
	}

	setRefreshTokenCookie(w, tokenResp.RefreshToken)
	RespondJSON(w, http.StatusOK, tokenResp)
}

// PostAuthSignupResend implements the verification code resend endpoint
func (s *Server) PostAuthSignupResend(w http.ResponseWriter, r *http.Request) {
	var req PostAuthSignupResendJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err := s.services.Auth.ResendVerificationCode(r.Context(), string(req.Email))
	if err != nil {
		switch err {
		case service.ErrAlreadyVerified:
			RespondErrorCode(w, http.StatusBadRequest, "ALREADY_VERIFIED", err.Error())
		case service.ErrResendTooSoon:
			RespondErrorCode(w, http.StatusTooManyRequests, "RESEND_TOO_SOON", err.Error())
		default:
			log.Printf("Resend verification error: %v", err)
			RespondError(w, http.StatusInternalServerError, "Failed to send verification code")
		}
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "인증 코드가 이메일로 발송되었습니다.",
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
			RespondErrorCode(w, http.StatusUnauthorized, "INVALID_LOGIN", err.Error())
			return
		}
		if err == service.ErrEmailNotVerified {
			RespondErrorCode(w, http.StatusForbidden, "EMAIL_NOT_VERIFIED", err.Error())
			return
		}
		log.Printf("[PostAuthLogin] Login error: %v", err)
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
		log.Printf("Google login error: %v", err)
		RespondError(w, http.StatusUnauthorized, err.Error())
		return
	}

	setRefreshTokenCookie(w, tokenResp.RefreshToken)
	RespondJSON(w, http.StatusOK, tokenResp)
}

// PostAuthLogout implements the POST /auth/logout endpoint
func (s *Server) PostAuthLogout(w http.ResponseWriter, r *http.Request, params PostAuthLogoutParams) {
	// Clear the refresh token cookie
	http.SetCookie(w, buildRefreshTokenCookie("", time.Unix(0, 0), -1))

	// We don't have server-side logout currently, just clear the cookie.

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}
