package service

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"time"

	"eventer-map-backend/internal/mailer"
	"eventer-map-backend/internal/repository"
	"encoding/json"
	"net/http"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/idtoken"
)

const (
	// JWTSecret should ideally be loaded from environment variables
	JWTSecret  = "super-secret-key-for-development"
	TokenExp   = time.Hour * 1      // 1 hour for access token
	RefreshExp = time.Hour * 24 * 7 // 7 days for refresh token
)

// AuthService handles authentication logic
type AuthService struct {
	repo   *repository.Queries
	mailer mailer.Mailer
}

func NewAuthService(repo *repository.Queries, mailer mailer.Mailer) *AuthService {
	return &AuthService{repo: repo, mailer: mailer}
}

// Custom errors
var (
	ErrUserExists      = errors.New("user already exists")
	ErrNicknameExists  = errors.New("nickname already exists")
	ErrInvalidLogin    = errors.New("invalid email or password")
	ErrInvalidPassword = errors.New("password must be at least 8 characters and contain both letters and numbers")
)

type TokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"-"` // Not exposed in JSON, only used for setting cookie
}

func (s *AuthService) generateTokens(userID string) (*TokenResponse, error) {
	// Access Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"type":    "access",
		"exp":     time.Now().Add(TokenExp).Unix(),
	})
	accessToken, err := token.SignedString([]byte(JWTSecret))
	if err != nil {
		return nil, err
	}

	// Refresh Token
	rt := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"type":    "refresh",
		"exp":     time.Now().Add(RefreshExp).Unix(),
	})
	refreshToken, err := rt.SignedString([]byte(JWTSecret))
	if err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func generateVerificationCode() string {
	// Simple 6 digit code for mock
	// In production use crypto/rand
	return "123456" // Hardcoded for simplicity or generate random
}

func (s *AuthService) Signup(ctx context.Context, email, displayName, password string) error {
	// 1. Validate password complexity (at least 8 chars, letters + numbers)
	if len(password) < 8 {
		return ErrInvalidPassword
	}
	hasLetter := regexp.MustCompile(`[a-zA-Z]`).MatchString(password)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)
	if !hasLetter || !hasNumber {
		return ErrInvalidPassword
	}

	// 2. Check if user email exists
	_, err := s.repo.GetUserByEmail(ctx, sql.NullString{String: email, Valid: true})
	if err == nil {
		return ErrUserExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	// 3. Check if nickname exists
	nicknameExists, err := s.repo.CheckNicknameExists(ctx, displayName)
	if err != nil {
		return err
	}
	if nicknameExists {
		return ErrNicknameExists
	}

	// 4. Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// 5. Create user (is_email_verified is false by default in DB)
	_, err = s.repo.CreateUser(ctx, repository.CreateUserParams{
		Email:        sql.NullString{String: email, Valid: true},
		DisplayName:  displayName,
		PasswordHash: sql.NullString{String: string(hashed), Valid: true},
	})
	if err != nil {
		return err
	}

	// 6. Generate and save verification token
	code := generateVerificationCode()
	_, err = s.repo.CreateVerificationToken(ctx, repository.CreateVerificationTokenParams{
		Email:     email,
		Code:      code,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	})
	if err != nil {
		return err
	}

	// 7. Send email
	return s.mailer.SendVerificationEmail(ctx, email, code)
}

func (s *AuthService) VerifyEmail(ctx context.Context, email, code string) (*TokenResponse, error) {
	token, err := s.repo.GetVerificationToken(ctx, repository.GetVerificationTokenParams{
		Email: email,
		Code:  code,
	})
	if err != nil {
		return nil, errors.New("invalid or expired verification code")
	}

	if time.Now().After(token.ExpiresAt) {
		return nil, errors.New("verification code expired")
	}

	// Update user status
	err = s.repo.UpdateUserEmailVerifiedByEmail(ctx, repository.UpdateUserEmailVerifiedByEmailParams{
		Email:           sql.NullString{String: email, Valid: true},
		IsEmailVerified: true,
	})
	if err != nil {
		return nil, err
	}

	// Delete token
	err = s.repo.DeleteVerificationToken(ctx, email)
	if err != nil {
		// Log error but continue to return token
	}

	// Get user to generate token
	user, err := s.repo.GetUserByEmail(ctx, sql.NullString{String: email, Valid: true})
	if err != nil {
		return nil, err
	}

	return s.generateTokens(user.ID.String())
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*TokenResponse, error) {
	user, err := s.repo.GetUserByEmail(ctx, sql.NullString{String: email, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidLogin
		}
		return nil, err
	}

	if !user.PasswordHash.Valid {
		return nil, ErrInvalidLogin
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(password))
	if err != nil {
		return nil, ErrInvalidLogin
	}

	return s.generateTokens(user.ID.String())
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	token, err := jwt.Parse(refreshToken, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(JWTSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid refresh token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	tokenType, ok := claims["type"].(string)
	if !ok || tokenType != "refresh" {
		return nil, errors.New("invalid token type")
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		return nil, errors.New("missing user_id in token")
	}

	return s.generateTokens(userID)
}

func (s *AuthService) GetUserByID(ctx context.Context, id uuid.UUID) (*repository.User, error) {
	user, err := s.repo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) VerifyGoogleAccessToken(ctx context.Context, accessToken string) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Add("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", errors.New("failed to fetch user info from google")
	}

	var userInfo struct {
		Sub   string `json:"sub"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return "", "", err
	}

	if userInfo.Sub == "" {
		return "", "", errors.New("invalid google user info")
	}

	return userInfo.Sub, userInfo.Email, nil
}

func (s *AuthService) VerifyGoogleIDToken(ctx context.Context, token string) (string, string, error) {
	// Usually you pass the Google Client ID here, but if not provided, you can just validate the signature
	payload, err := idtoken.Validate(ctx, token, "") // "" skips audience validation if you don't enforce a single client ID here
	if err != nil {
		return "", "", err
	}

	googleID, ok := payload.Claims["sub"].(string)
	if !ok {
		return "", "", errors.New("invalid google id in token")
	}

	email, ok := payload.Claims["email"].(string)
	if !ok {
		return "", "", errors.New("invalid email in token")
	}

	return googleID, email, nil
}

func (s *AuthService) LinkGoogleAccount(ctx context.Context, userID uuid.UUID, token string, isAccessToken bool) error {
	var googleID string
	var err error
	if isAccessToken {
		googleID, _, err = s.VerifyGoogleAccessToken(ctx, token)
	} else {
		googleID, _, err = s.VerifyGoogleIDToken(ctx, token)
	}
	
	if err != nil {
		return errors.New("invalid google token")
	}

	// Check if this google account is already linked to another user
	existingUser, err := s.repo.GetUserByGoogleID(ctx, sql.NullString{String: googleID, Valid: true})
	if err == nil && existingUser.ID != userID {
		return errors.New("this google account is already linked to another user")
	}

	// Link to current user
	return s.repo.UpdateUserGoogleID(ctx, repository.UpdateUserGoogleIDParams{
		ID:       userID,
		GoogleID: sql.NullString{String: googleID, Valid: true},
	})
}
