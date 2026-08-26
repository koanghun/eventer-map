package service

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"time"

	"eventer-map-backend/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	// JWTSecret should ideally be loaded from environment variables
	JWTSecret = "super-secret-key-for-development"
	TokenExp  = time.Hour * 24 * 7 // 7 days
)

// AuthService handles authentication logic
type AuthService struct {
	repo *repository.Queries
}

func NewAuthService(repo *repository.Queries) *AuthService {
	return &AuthService{repo: repo}
}

// Custom errors
var (
	ErrUserExists      = errors.New("user already exists")
	ErrNicknameExists  = errors.New("nickname already exists")
	ErrInvalidLogin    = errors.New("invalid email or password")
	ErrInvalidPassword = errors.New("password must be at least 8 characters and contain both letters and numbers")
)

type TokenResponse struct {
	Token string
}

func (s *AuthService) Signup(ctx context.Context, email, displayName, password string) (*repository.User, error) {
	// 1. Validate password complexity (at least 8 chars, letters + numbers)
	if len(password) < 8 {
		return nil, ErrInvalidPassword
	}
	hasLetter := regexp.MustCompile(`[a-zA-Z]`).MatchString(password)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)
	if !hasLetter || !hasNumber {
		return nil, ErrInvalidPassword
	}

	// 2. Check if user email exists
	_, err := s.repo.GetUserByEmail(ctx, sql.NullString{String: email, Valid: true})
	if err == nil {
		return nil, ErrUserExists
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// 3. Check if nickname exists
	nicknameExists, err := s.repo.CheckNicknameExists(ctx, displayName)
	if err != nil {
		return nil, err
	}
	if nicknameExists {
		return nil, ErrNicknameExists
	}

	// 4. Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// 5. Create user
	user, err := s.repo.CreateUser(ctx, repository.CreateUserParams{
		Email:        sql.NullString{String: email, Valid: true},
		DisplayName:  displayName,
		PasswordHash: sql.NullString{String: string(hashed), Valid: true},
	})
	if err != nil {
		return nil, err
	}

	return &user, nil
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

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID.String(),
		"exp":     time.Now().Add(TokenExp).Unix(),
	})

	tokenString, err := token.SignedString([]byte(JWTSecret))
	if err != nil {
		return nil, err
	}

	return &TokenResponse{Token: tokenString}, nil
}
