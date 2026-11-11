package service

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"eventer-map-backend/internal/auth"
	"eventer-map-backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

const (
	xReauthTokenExp        = 5 * time.Minute
	maxNicknameRunes       = 30
	minNicknameRunes       = 2
	maxNicknameSuffixRetry = 6
)

func (s *AuthService) isXOAuthConfigured() bool {
	return s.xClient != nil && s.xClient.IsConfigured() && s.stateStore != nil
}

// StartXOAuth initializes an X OAuth 2.0 PKCE authorization flow and returns the authorize URL.
// TODO(security): enforce per-IP / per-user rate limiting at API Gateway WAF or middleware for OAuth endpoints.
func (s *AuthService) StartXOAuth(ctx context.Context, mode string, userID *uuid.UUID) (string, error) {
	if !s.isXOAuthConfigured() {
		return "", ErrXOAuthNotConfigured
	}

	userIDStr := ""
	switch mode {
	case auth.ModeLogin:
		if userID != nil {
			return "", ErrOAuthStateInvalid
		}
	case auth.ModeLink, auth.ModeReauth:
		if userID == nil || *userID == uuid.Nil {
			return "", ErrOAuthStateInvalid
		}
		user, err := s.repo.GetUserByID(ctx, *userID)
		if err != nil {
			return "", err
		}
		if mode == auth.ModeLink && user.XID.Valid {
			return "", ErrXAlreadyLinked
		}
		if mode == auth.ModeReauth && !user.XID.Valid {
			return "", ErrReauthRequired
		}
		userIDStr = userID.String()
	default:
		return "", ErrOAuthStateInvalid
	}

	state, err := auth.GenerateState()
	if err != nil {
		return "", err
	}
	verifier, challenge, err := auth.GeneratePKCE()
	if err != nil {
		return "", err
	}

	err = s.stateStore.Save(ctx, auth.OAuthState{
		StateHash:    auth.HashState(state),
		Provider:     auth.ProviderX,
		Mode:         mode,
		CodeVerifier: verifier,
		UserID:       userIDStr,
		ExpiresAt:    time.Now().Add(auth.OAuthStateTTL),
	})
	if err != nil {
		return "", err
	}

	return s.xClient.BuildAuthorizeURL(state, challenge)
}

func (s *AuthService) exchangeXOAuthState(ctx context.Context, expectedMode string, expectedUserID *uuid.UUID, code, state string) (*auth.XUser, error) {
	if !s.isXOAuthConfigured() {
		return nil, ErrXOAuthNotConfigured
	}
	if strings.TrimSpace(code) == "" || strings.TrimSpace(state) == "" {
		return nil, ErrOAuthStateInvalid
	}

	record, err := s.stateStore.Consume(ctx, auth.HashState(state), auth.ProviderX)
	if err != nil {
		if errors.Is(err, auth.ErrOAuthStateNotFound) {
			return nil, ErrOAuthStateInvalid
		}
		return nil, err
	}

	if record.Mode != expectedMode {
		return nil, ErrOAuthStateInvalid
	}
	if expectedUserID == nil {
		if record.UserID != "" {
			return nil, ErrOAuthStateInvalid
		}
	} else if record.UserID != expectedUserID.String() {
		return nil, ErrOAuthStateInvalid
	}

	accessToken, err := s.xClient.ExchangeCode(ctx, code, record.CodeVerifier)
	if err != nil {
		log.Printf("X OAuth code exchange failed (mode=%s): %v", expectedMode, err)
		return nil, ErrXOAuthExchangeFailed
	}

	xUser, err := s.xClient.FetchUser(ctx, accessToken)
	if err != nil || xUser == nil || strings.TrimSpace(xUser.ID) == "" {
		log.Printf("X OAuth user fetch failed (mode=%s): %v", expectedMode, err)
		return nil, ErrXOAuthExchangeFailed
	}

	return xUser, nil
}

// CompleteXLogin completes X OAuth login or auto-signup and issues Eventer Map JWT tokens.
func (s *AuthService) CompleteXLogin(ctx context.Context, code, state string) (*TokenResponse, error) {
	xUser, err := s.exchangeXOAuthState(ctx, auth.ModeLogin, nil, code, state)
	if err != nil {
		return nil, err
	}

	xUsername := normalizeXUsername(xUser.Username)

	user, err := s.repo.GetUserByXID(ctx, sql.NullString{String: xUser.ID, Valid: true})
	switch {
	case err == nil:
		if user.IsBanned {
			return nil, ErrUserBanned
		}
		s.syncXUsername(ctx, user, xUsername)
		return s.generateTokens(user.ID.String())
	case !errors.Is(err, sql.ErrNoRows):
		return nil, err
	}

	email := strings.ToLower(strings.TrimSpace(xUser.ConfirmedEmail))
	if email != "" {
		_, err := s.repo.GetUserByEmail(ctx, sql.NullString{String: email, Valid: true})
		if err == nil {
			// Do not auto-merge unlinked accounts by email to prevent account takeover.
			return nil, ErrEmailConflict
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
	}

	newUser, err := s.createUserWithUniqueNickname(ctx, xUser, xUsername, email)
	if err != nil {
		return nil, err
	}
	if newUser.IsBanned {
		return nil, ErrUserBanned
	}

	return s.generateTokens(newUser.ID.String())
}

// LinkXAccount links an authenticated Eventer Map user to an X account.
func (s *AuthService) LinkXAccount(ctx context.Context, userID uuid.UUID, code, state string) error {
	xUser, err := s.exchangeXOAuthState(ctx, auth.ModeLink, &userID, code, state)
	if err != nil {
		return err
	}

	currentUser, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if currentUser.XID.Valid {
		return ErrXAlreadyLinked
	}

	existingUser, err := s.repo.GetUserByXID(ctx, sql.NullString{String: xUser.ID, Valid: true})
	if err == nil && existingUser.ID != userID {
		return ErrXAccountConflict
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	err = s.repo.UpdateUserXAccount(ctx, repository.UpdateUserXAccountParams{
		ID:        userID,
		XID:       sql.NullString{String: xUser.ID, Valid: true},
		XUsername: toNullString(normalizeXUsername(xUser.Username)),
	})
	if isUniqueConstraintViolation(err, "x_id") {
		return ErrXAccountConflict
	}
	return err
}

// UnlinkXAccount removes X login linkage after ensuring another usable login method remains.
func (s *AuthService) UnlinkXAccount(ctx context.Context, userID uuid.UUID) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if !hasUsablePasswordLogin(user) && !user.GoogleID.Valid {
		return ErrCannotUnlinkLastAuth
	}

	return s.repo.UpdateUserXAccount(ctx, repository.UpdateUserXAccountParams{
		ID:        userID,
		XID:       sql.NullString{Valid: false},
		XUsername: sql.NullString{Valid: false},
	})
}

// CompleteXReauth verifies that the user re-authenticated with their linked X account
// and returns a short-lived single-purpose JWT token for account deletion.
func (s *AuthService) CompleteXReauth(ctx context.Context, userID uuid.UUID, code, state string) (string, error) {
	xUser, err := s.exchangeXOAuthState(ctx, auth.ModeReauth, &userID, code, state)
	if err != nil {
		return "", err
	}

	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return "", err
	}
	if !user.XID.Valid {
		return "", ErrReauthRequired
	}
	if user.XID.String != xUser.ID {
		return "", ErrXAccountMismatch
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID.String(),
		"x_id":    xUser.ID,
		"type":    "x_reauth",
		"exp":     time.Now().Add(xReauthTokenExp).Unix(),
	})
	return token.SignedString(GetJWTSecret())
}

// VerifyXReauthToken validates a short-lived X re-authentication token and returns the verified X ID.
func (s *AuthService) VerifyXReauthToken(_ context.Context, expectedUserID uuid.UUID, tokenStr string) (string, error) {
	token, err := jwt.Parse(
		tokenStr,
		func(_ *jwt.Token) (interface{}, error) {
			return GetJWTSecret(), nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
	)
	if err != nil || !token.Valid {
		return "", ErrInvalidXReauthToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", ErrInvalidXReauthToken
	}
	tokenType, _ := claims["type"].(string)
	userID, _ := claims["user_id"].(string)
	xID, _ := claims["x_id"].(string)

	if tokenType != "x_reauth" || userID != expectedUserID.String() || xID == "" {
		return "", ErrInvalidXReauthToken
	}
	return xID, nil
}

func (s *AuthService) syncXUsername(ctx context.Context, user repository.User, xUsername string) {
	if xUsername == "" || (user.XUsername.Valid && user.XUsername.String == xUsername) {
		return
	}
	err := s.repo.UpdateUserXAccount(ctx, repository.UpdateUserXAccountParams{
		ID:        user.ID,
		XID:       user.XID,
		XUsername: sql.NullString{String: xUsername, Valid: true},
	})
	if err != nil {
		log.Printf("failed to sync X username for user %s: %v", user.ID, err)
	}
}

func (s *AuthService) createUserWithUniqueNickname(ctx context.Context, xUser *auth.XUser, xUsername, email string) (repository.User, error) {
	baseNickname := buildBaseXDisplayName(xUser)
	emailParam := toNullString(email)
	isEmailVerified := email != ""
	xUsernameParam := toNullString(xUsername)

	candidate := baseNickname
	for attempt := 0; attempt < maxNicknameSuffixRetry; attempt++ {
		if attempt == 0 {
			exists, err := s.repo.CheckNicknameExists(ctx, candidate)
			if err != nil {
				return repository.User{}, err
			}
			if exists {
				var suffixErr error
				candidate, suffixErr = withRandomHexSuffix(baseNickname)
				if suffixErr != nil {
					return repository.User{}, suffixErr
				}
			}
		} else {
			var suffixErr error
			candidate, suffixErr = withRandomHexSuffix(baseNickname)
			if suffixErr != nil {
				return repository.User{}, suffixErr
			}
		}

		user, err := s.repo.CreateUser(ctx, repository.CreateUserParams{
			Email:           emailParam,
			DisplayName:     candidate,
			PasswordHash:    sql.NullString{Valid: false},
			GoogleID:        sql.NullString{Valid: false},
			XID:             sql.NullString{String: xUser.ID, Valid: true},
			XUsername:       xUsernameParam,
			IsEmailVerified: isEmailVerified,
		})
		if err == nil {
			return user, nil
		}

		if isUniqueConstraintViolation(err, "x_id") {
			return s.repo.GetUserByXID(ctx, sql.NullString{String: xUser.ID, Valid: true})
		}
		if isUniqueConstraintViolation(err, "email") {
			return repository.User{}, ErrEmailConflict
		}
		if isUniqueConstraintViolation(err, "display_name") {
			continue
		}
		return repository.User{}, err
	}

	return repository.User{}, ErrNicknameExists
}

func normalizeXUsername(raw string) string {
	return strings.TrimPrefix(strings.TrimSpace(raw), "@")
}

func toNullString(v string) sql.NullString {
	if v == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: v, Valid: true}
}

func buildBaseXDisplayName(xUser *auth.XUser) string {
	candidate := normalizeXUsername(xUser.Username)
	if candidate == "" {
		candidate = sanitizeDisplayName(xUser.Name)
	} else {
		candidate = sanitizeDisplayName(candidate)
	}
	if candidate == "" {
		candidate = "x_user"
	}

	candidate = truncateRunes(candidate, maxNicknameRunes)
	if utf8.RuneCountInString(candidate) < minNicknameRunes {
		candidate += "_x"
	}
	return candidate
}

func sanitizeDisplayName(raw string) string {
	var b strings.Builder
	lastUnderscore := false
	for _, r := range strings.TrimSpace(raw) {
		if unicode.IsSpace(r) {
			if !lastUnderscore && b.Len() > 0 {
				b.WriteByte('_')
				lastUnderscore = true
			}
			continue
		}
		if unicode.IsControl(r) {
			continue
		}
		b.WriteRune(r)
		lastUnderscore = (r == '_')
	}
	return strings.Trim(b.String(), "_")
}

func withRandomHexSuffix(base string) (string, error) {
	var buf [2]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	suffix := "_" + hex.EncodeToString(buf[:])
	// 5-char suffix ("_xxxx") leaves room for up to 25 runes in the base.
	prefix := truncateRunes(base, maxNicknameRunes-len(suffix))
	if prefix == "" {
		prefix = "x"
	}
	return fmt.Sprintf("%s%s", prefix, suffix), nil
}

func truncateRunes(s string, maxRunes int) string {
	if maxRunes <= 0 || utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	runes := []rune(s)
	return string(runes[:maxRunes])
}

func isUniqueConstraintViolation(err error, constraintSubstr string) bool {
	if err == nil {
		return false
	}
	var pqErr *pq.Error
	if !errors.As(err, &pqErr) {
		return false
	}
	if pqErr.Code != "23505" {
		return false
	}
	return strings.Contains(pqErr.Constraint, constraintSubstr)
}

