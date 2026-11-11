package service

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"eventer-map-backend/internal/auth"
	"eventer-map-backend/internal/mailer"
	"eventer-map-backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type fakeAuthRepo struct {
	authRepository
	usersByID       map[uuid.UUID]repository.User
	usersByEmail    map[string]repository.User
	usersByGoogleID map[string]repository.User
	usersByXID      map[string]repository.User
	nicknames       map[string]bool
	forceCreateErr  error
	createAttempts  int
	failNextCreate  bool
}

func newFakeAuthRepo() *fakeAuthRepo {
	return &fakeAuthRepo{
		usersByID:       make(map[uuid.UUID]repository.User),
		usersByEmail:    make(map[string]repository.User),
		usersByGoogleID: make(map[string]repository.User),
		usersByXID:      make(map[string]repository.User),
		nicknames:       make(map[string]bool),
	}
}

func (f *fakeAuthRepo) seed(u repository.User) {
	f.usersByID[u.ID] = u
	if u.Email.Valid && u.Email.String != "" {
		f.usersByEmail[u.Email.String] = u
	}
	if u.GoogleID.Valid && u.GoogleID.String != "" {
		f.usersByGoogleID[u.GoogleID.String] = u
	}
	if u.XID.Valid && u.XID.String != "" {
		f.usersByXID[u.XID.String] = u
	}
	if u.DisplayName != "" {
		f.nicknames[u.DisplayName] = true
	}
}

func (f *fakeAuthRepo) GetUserByID(_ context.Context, id uuid.UUID) (repository.User, error) {
	u, ok := f.usersByID[id]
	if !ok {
		return repository.User{}, sql.ErrNoRows
	}
	return u, nil
}

func (f *fakeAuthRepo) GetUserByEmail(_ context.Context, email sql.NullString) (repository.User, error) {
	if !email.Valid {
		return repository.User{}, sql.ErrNoRows
	}
	u, ok := f.usersByEmail[email.String]
	if !ok {
		return repository.User{}, sql.ErrNoRows
	}
	return u, nil
}

func (f *fakeAuthRepo) GetUserByGoogleID(_ context.Context, googleID sql.NullString) (repository.User, error) {
	if !googleID.Valid {
		return repository.User{}, sql.ErrNoRows
	}
	u, ok := f.usersByGoogleID[googleID.String]
	if !ok {
		return repository.User{}, sql.ErrNoRows
	}
	return u, nil
}

func (f *fakeAuthRepo) GetUserByXID(_ context.Context, xID sql.NullString) (repository.User, error) {
	if !xID.Valid {
		return repository.User{}, sql.ErrNoRows
	}
	u, ok := f.usersByXID[xID.String]
	if !ok {
		return repository.User{}, sql.ErrNoRows
	}
	return u, nil
}

func (f *fakeAuthRepo) CheckNicknameExists(_ context.Context, displayName string) (bool, error) {
	return f.nicknames[displayName], nil
}

func (f *fakeAuthRepo) CreateUser(_ context.Context, arg repository.CreateUserParams) (repository.User, error) {
	f.createAttempts++
	if f.forceCreateErr != nil {
		return repository.User{}, f.forceCreateErr
	}
	if f.failNextCreate {
		f.failNextCreate = false
		return repository.User{}, &pq.Error{Code: "23505", Constraint: "users_display_name_key"}
	}
	if f.nicknames[arg.DisplayName] {
		return repository.User{}, &pq.Error{Code: "23505", Constraint: "users_display_name_key"}
	}
	if arg.Email.Valid {
		if _, exists := f.usersByEmail[arg.Email.String]; exists {
			return repository.User{}, &pq.Error{Code: "23505", Constraint: "users_email_key"}
		}
	}
	if arg.XID.Valid {
		if _, exists := f.usersByXID[arg.XID.String]; exists {
			return repository.User{}, &pq.Error{Code: "23505", Constraint: "users_x_id_key"}
		}
	}

	u := repository.User{
		ID:              uuid.New(),
		Email:           arg.Email,
		DisplayName:     arg.DisplayName,
		PasswordHash:    arg.PasswordHash,
		GoogleID:        arg.GoogleID,
		XID:             arg.XID,
		XUsername:       arg.XUsername,
		IsEmailVerified: arg.IsEmailVerified,
		Role:            "USER",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	f.seed(u)
	return u, nil
}

func (f *fakeAuthRepo) UpdateUserGoogleID(_ context.Context, arg repository.UpdateUserGoogleIDParams) error {
	u, ok := f.usersByID[arg.ID]
	if !ok {
		return sql.ErrNoRows
	}
	if u.GoogleID.Valid {
		delete(f.usersByGoogleID, u.GoogleID.String)
	}
	u.GoogleID = arg.GoogleID
	f.seed(u)
	return nil
}

func (f *fakeAuthRepo) UpdateUserXAccount(_ context.Context, arg repository.UpdateUserXAccountParams) error {
	u, ok := f.usersByID[arg.ID]
	if !ok {
		return sql.ErrNoRows
	}
	if arg.XID.Valid {
		if other, exists := f.usersByXID[arg.XID.String]; exists && other.ID != arg.ID {
			return &pq.Error{Code: "23505", Constraint: "users_x_id_key"}
		}
	}
	if u.XID.Valid {
		delete(f.usersByXID, u.XID.String)
	}
	u.XID = arg.XID
	u.XUsername = arg.XUsername
	f.seed(u)
	return nil
}

type fakeUserRepo struct {
	userRepository
	users   map[uuid.UUID]repository.User
	deleted map[uuid.UUID]bool
	dropped []string
}

func newFakeUserRepo(users ...repository.User) *fakeUserRepo {
	r := &fakeUserRepo{
		users:   make(map[uuid.UUID]repository.User),
		deleted: make(map[uuid.UUID]bool),
	}
	for _, u := range users {
		r.users[u.ID] = u
	}
	return r
}

func (f *fakeUserRepo) GetUserByID(_ context.Context, id uuid.UUID) (repository.User, error) {
	u, ok := f.users[id]
	if !ok {
		return repository.User{}, sql.ErrNoRows
	}
	return u, nil
}

func (f *fakeUserRepo) DeleteVerificationToken(_ context.Context, email string) error {
	f.dropped = append(f.dropped, email)
	return nil
}

func (f *fakeUserRepo) DeleteUser(_ context.Context, id uuid.UUID) error {
	if _, ok := f.users[id]; !ok {
		return sql.ErrNoRows
	}
	delete(f.users, id)
	f.deleted[id] = true
	return nil
}

func (f *fakeUserRepo) UpdateUserPassword(_ context.Context, arg repository.UpdateUserPasswordParams) error {
	u, ok := f.users[arg.ID]
	if !ok {
		return sql.ErrNoRows
	}
	u.PasswordHash = arg.PasswordHash
	f.users[arg.ID] = u
	return nil
}

type fakeXOAuthProvider struct {
	configured    bool
	exchangeFn    func(code, verifier string) (string, error)
	fetchUserFn   func(token string) (*auth.XUser, error)
	lastChallenge string
}

func (f *fakeXOAuthProvider) IsConfigured() bool { return f.configured }

func (f *fakeXOAuthProvider) BuildAuthorizeURL(state, codeChallenge string) (string, error) {
	f.lastChallenge = codeChallenge
	u, _ := url.Parse("https://x.com/i/oauth2/authorize")
	q := u.Query()
	q.Set("state", state)
	q.Set("code_challenge", codeChallenge)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (f *fakeXOAuthProvider) ExchangeCode(_ context.Context, code, verifier string) (string, error) {
	if f.exchangeFn != nil {
		return f.exchangeFn(code, verifier)
	}
	return "x-access-" + code + ":" + verifier, nil
}

func (f *fakeXOAuthProvider) FetchUser(_ context.Context, token string) (*auth.XUser, error) {
	if f.fetchUserFn != nil {
		return f.fetchUserFn(token)
	}
	return &auth.XUser{ID: "x-user-1", Name: "Eventer", Username: "eventer_jp"}, nil
}

func extractStateFromAuthorizeURL(t *testing.T, rawURL string) string {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("failed to parse authorize URL: %v", err)
	}
	state := parsed.Query().Get("state")
	if state == "" {
		t.Fatal("missing state query param in authorize URL")
	}
	return state
}

func TestCompleteXLogin_NewUserWithoutEmailAndNicknameCollision(t *testing.T) {
	repo := newFakeAuthRepo()
	repo.seed(repository.User{
		ID:          uuid.New(),
		DisplayName: "eventer_jp",
		Email:       sql.NullString{String: "other@example.com", Valid: true},
	})
	repo.failNextCreate = true // force a race-condition 23505 retry too

	store := auth.NewInMemoryOAuthStateStore()
	xClient := &fakeXOAuthProvider{
		configured: true,
		fetchUserFn: func(_ string) (*auth.XUser, error) {
			return &auth.XUser{
				ID:       "999001",
				Name:     "Eventer JP",
				Username: "eventer_jp",
			}, nil
		},
	}
	svc := NewAuthServiceWithXOAuth(repo, mailer.NewFromEnv(), xClient, store)

	authURL, err := svc.StartXOAuth(context.Background(), auth.ModeLogin, nil)
	if err != nil {
		t.Fatalf("StartXOAuth failed: %v", err)
	}
	state := extractStateFromAuthorizeURL(t, authURL)

	tokens, err := svc.CompleteXLogin(context.Background(), "auth-code-1", state)
	if err != nil {
		t.Fatalf("CompleteXLogin failed: %v", err)
	}
	if tokens.AccessToken == "" || tokens.RefreshToken == "" {
		t.Fatal("expected JWT access and refresh tokens")
	}
	if repo.createAttempts != 2 {
		t.Fatalf("expected 2 create attempts after 23505 retry, got %d", repo.createAttempts)
	}

	created, err := repo.GetUserByXID(context.Background(), sql.NullString{String: "999001", Valid: true})
	if err != nil {
		t.Fatalf("expected created user in repo: %v", err)
	}
	if created.Email.Valid {
		t.Fatalf("expected email to be NULL when X returns no email, got %q", created.Email.String)
	}
	if created.IsEmailVerified {
		t.Fatal("expected is_email_verified=false when no email was provided")
	}
	if !strings.HasPrefix(created.DisplayName, "eventer_jp_") {
		t.Fatalf("expected collision suffix on display name, got %q", created.DisplayName)
	}
	if n := utf8.RuneCountInString(created.DisplayName); n < 2 || n > 30 {
		t.Fatalf("expected display name rune count in [2,30], got %d (%q)", n, created.DisplayName)
	}
	if !created.XUsername.Valid || created.XUsername.String != "eventer_jp" {
		t.Fatalf("expected x_username=eventer_jp, got %+v", created.XUsername)
	}

	// Replaying the same state/code must fail because state is single-use.
	if _, err := svc.CompleteXLogin(context.Background(), "auth-code-1", state); !errors.Is(err, ErrOAuthStateInvalid) {
		t.Fatalf("expected ErrOAuthStateInvalid on replay, got %v", err)
	}
}

func TestCompleteXLogin_ReturningSyncAndSecurityChecks(t *testing.T) {
	ctx := context.Background()
	repo := newFakeAuthRepo()
	returningID := uuid.New()
	repo.seed(repository.User{
		ID:          returningID,
		DisplayName: "old_nick",
		XID:         sql.NullString{String: "x-ret-1", Valid: true},
		XUsername:   sql.NullString{String: "old_handle", Valid: true},
	})
	bannedID := uuid.New()
	repo.seed(repository.User{
		ID:          bannedID,
		DisplayName: "banned_user",
		XID:         sql.NullString{String: "x-banned", Valid: true},
		IsBanned:    true,
	})
	repo.seed(repository.User{
		ID:              uuid.New(),
		DisplayName:     "existing_email_user",
		Email:           sql.NullString{String: "taken@example.com", Valid: true},
		IsEmailVerified: true,
	})

	store := auth.NewInMemoryOAuthStateStore()
	nextUser := &auth.XUser{ID: "x-ret-1", Username: "new_handle"}
	xClient := &fakeXOAuthProvider{
		configured:  true,
		fetchUserFn: func(_ string) (*auth.XUser, error) { return nextUser, nil },
	}
	svc := NewAuthServiceWithXOAuth(repo, mailer.NewFromEnv(), xClient, store)

	// 1. Returning user syncs updated x_username
	u1, _ := svc.StartXOAuth(ctx, auth.ModeLogin, nil)
	if _, err := svc.CompleteXLogin(ctx, "c1", extractStateFromAuthorizeURL(t, u1)); err != nil {
		t.Fatalf("returning login failed: %v", err)
	}
	updated, _ := repo.GetUserByID(ctx, returningID)
	if !updated.XUsername.Valid || updated.XUsername.String != "new_handle" {
		t.Fatalf("expected x_username synced to new_handle, got %+v", updated.XUsername)
	}

	// 2. Banned user is blocked
	nextUser = &auth.XUser{ID: "x-banned", Username: "banned_handle"}
	u2, _ := svc.StartXOAuth(ctx, auth.ModeLogin, nil)
	if _, err := svc.CompleteXLogin(ctx, "c2", extractStateFromAuthorizeURL(t, u2)); !errors.Is(err, ErrUserBanned) {
		t.Fatalf("expected ErrUserBanned, got %v", err)
	}

	// 3. Confirmed email colliding with existing account returns ErrEmailConflict
	nextUser = &auth.XUser{ID: "x-fresh", Username: "fresh_handle", ConfirmedEmail: "TAKEN@example.com"}
	u3, _ := svc.StartXOAuth(ctx, auth.ModeLogin, nil)
	if _, err := svc.CompleteXLogin(ctx, "c3", extractStateFromAuthorizeURL(t, u3)); !errors.Is(err, ErrEmailConflict) {
		t.Fatalf("expected ErrEmailConflict, got %v", err)
	}
}

func TestLinkAndUnlinkXAccount(t *testing.T) {
	ctx := context.Background()
	repo := newFakeAuthRepo()

	userA := uuid.New()
	repo.seed(repository.User{
		ID:              userA,
		DisplayName:     "userA",
		Email:           sql.NullString{String: "a@example.com", Valid: true},
		PasswordHash:    sql.NullString{String: "hashed", Valid: true},
		IsEmailVerified: true,
	})
	userB := uuid.New()
	repo.seed(repository.User{
		ID:          userB,
		DisplayName: "userB",
		XID:         sql.NullString{String: "x-other", Valid: true},
		XUsername:   sql.NullString{String: "other_x", Valid: true},
	})
	userXOnly := uuid.New()
	repo.seed(repository.User{
		ID:          userXOnly,
		DisplayName: "xonly",
		XID:         sql.NullString{String: "x-only-id", Valid: true},
		XUsername:   sql.NullString{String: "x_only_handle", Valid: true},
	})

	store := auth.NewInMemoryOAuthStateStore()
	xUserToReturn := &auth.XUser{ID: "x-other", Username: "other_x"}
	xClient := &fakeXOAuthProvider{
		configured:  true,
		fetchUserFn: func(_ string) (*auth.XUser, error) { return xUserToReturn, nil },
	}
	svc := NewAuthServiceWithXOAuth(repo, mailer.NewFromEnv(), xClient, store)

	// CSRF test: state created for userA cannot be consumed by userB
	linkURLForA, err := svc.StartXOAuth(ctx, auth.ModeLink, &userA)
	if err != nil {
		t.Fatalf("StartXOAuth failed: %v", err)
	}
	stateA := extractStateFromAuthorizeURL(t, linkURLForA)
	if err := svc.LinkXAccount(ctx, userXOnly, "c", stateA); !errors.Is(err, ErrOAuthStateInvalid) {
		t.Fatalf("expected ErrOAuthStateInvalid for mismatched user_id, got %v", err)
	}

	// Conflict test: X account already linked to userB returns ErrXAccountConflict
	linkURLForA2, _ := svc.StartXOAuth(ctx, auth.ModeLink, &userA)
	if err := svc.LinkXAccount(ctx, userA, "c", extractStateFromAuthorizeURL(t, linkURLForA2)); !errors.Is(err, ErrXAccountConflict) {
		t.Fatalf("expected ErrXAccountConflict, got %v", err)
	}

	// Successful link for userA
	xUserToReturn = &auth.XUser{ID: "x-new-for-a", Username: "a_handle"}
	linkURLForA3, _ := svc.StartXOAuth(ctx, auth.ModeLink, &userA)
	if err := svc.LinkXAccount(ctx, userA, "c", extractStateFromAuthorizeURL(t, linkURLForA3)); err != nil {
		t.Fatalf("LinkXAccount failed: %v", err)
	}
	gotA, _ := repo.GetUserByID(ctx, userA)
	if !gotA.XID.Valid || gotA.XID.String != "x-new-for-a" || !gotA.XUsername.Valid || gotA.XUsername.String != "a_handle" {
		t.Fatalf("unexpected linked user state: %+v", gotA)
	}

	// X-only user cannot unlink their last login method
	if err := svc.UnlinkXAccount(ctx, userXOnly); !errors.Is(err, ErrCannotUnlinkLastAuth) {
		t.Fatalf("expected ErrCannotUnlinkLastAuth for X-only user, got %v", err)
	}

	// UserA has verified email + password, so unlinking X succeeds and clears both x_id and x_username
	if err := svc.UnlinkXAccount(ctx, userA); err != nil {
		t.Fatalf("UnlinkXAccount failed for userA: %v", err)
	}
	gotA, _ = repo.GetUserByID(ctx, userA)
	if gotA.XID.Valid || gotA.XUsername.Valid {
		t.Fatalf("expected X fields cleared on unlink, got x_id=%+v x_username=%+v", gotA.XID, gotA.XUsername)
	}

	// Unlinking Google when user only has Google must also fail with ErrCannotUnlinkLastAuth
	userGoogleOnly := uuid.New()
	repo.seed(repository.User{
		ID:              userGoogleOnly,
		DisplayName:     "gonly",
		Email:           sql.NullString{String: "g@example.com", Valid: true},
		GoogleID:        sql.NullString{String: "g-1", Valid: true},
		IsEmailVerified: true,
	})
	if err := svc.UnlinkGoogleAccount(ctx, userGoogleOnly); !errors.Is(err, ErrCannotUnlinkLastAuth) {
		t.Fatalf("expected ErrCannotUnlinkLastAuth for Google-only user, got %v", err)
	}
}

func TestCompleteXReauth_AndDeleteAccount_AndPasswordGuard(t *testing.T) {
	ctx := context.Background()
	repo := newFakeAuthRepo()

	userXOnlyID := uuid.New()
	userXOnly := repository.User{
		ID:          userXOnlyID,
		DisplayName: "x_deleter",
		XID:         sql.NullString{String: "x-del-1", Valid: true},
		XUsername:   sql.NullString{String: "x_del", Valid: true},
	}
	repo.seed(userXOnly)

	pwHash, _ := bcrypt.GenerateFromPassword([]byte("Pass1234"), bcrypt.MinCost)
	userWithPwID := uuid.New()
	userWithPw := repository.User{
		ID:              userWithPwID,
		DisplayName:     "pw_user",
		Email:           sql.NullString{String: "pw@example.com", Valid: true},
		PasswordHash:    sql.NullString{String: string(pwHash), Valid: true},
		IsEmailVerified: true,
	}
	repo.seed(userWithPw)

	store := auth.NewInMemoryOAuthStateStore()
	xUser := &auth.XUser{ID: "x-wrong", Username: "wrong"}
	xClient := &fakeXOAuthProvider{
		configured:  true,
		fetchUserFn: func(_ string) (*auth.XUser, error) { return xUser, nil },
	}
	authSvc := NewAuthServiceWithXOAuth(repo, mailer.NewFromEnv(), xClient, store)

	// Reauth with wrong X account returns ErrXAccountMismatch
	reauthURL, err := authSvc.StartXOAuth(ctx, auth.ModeReauth, &userXOnlyID)
	if err != nil {
		t.Fatalf("StartXOAuth reauth failed: %v", err)
	}
	if _, err := authSvc.CompleteXReauth(ctx, userXOnlyID, "c", extractStateFromAuthorizeURL(t, reauthURL)); !errors.Is(err, ErrXAccountMismatch) {
		t.Fatalf("expected ErrXAccountMismatch, got %v", err)
	}

	// Reauth with linked X account succeeds and yields valid x_reauth token
	xUser = &auth.XUser{ID: "x-del-1", Username: "x_del"}
	reauthURL2, _ := authSvc.StartXOAuth(ctx, auth.ModeReauth, &userXOnlyID)
	reauthToken, err := authSvc.CompleteXReauth(ctx, userXOnlyID, "c", extractStateFromAuthorizeURL(t, reauthURL2))
	if err != nil {
		t.Fatalf("CompleteXReauth failed: %v", err)
	}
	verifiedXID, err := authSvc.VerifyXReauthToken(ctx, userXOnlyID, reauthToken)
	if err != nil || verifiedXID != "x-del-1" {
		t.Fatalf("VerifyXReauthToken failed: xid=%q err=%v", verifiedXID, err)
	}
	if _, err := authSvc.VerifyXReauthToken(ctx, userWithPwID, reauthToken); !errors.Is(err, ErrInvalidXReauthToken) {
		t.Fatalf("expected ErrInvalidXReauthToken for different user, got %v", err)
	}

	// Alg=none token must be rejected
	noneToken := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"user_id": userXOnlyID.String(),
		"x_id":    "x-del-1",
		"type":    "x_reauth",
		"exp":     time.Now().Add(time.Minute).Unix(),
	})
	noneStr, _ := noneToken.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if _, err := authSvc.VerifyXReauthToken(ctx, userXOnlyID, noneStr); !errors.Is(err, ErrInvalidXReauthToken) {
		t.Fatalf("expected alg=none to be rejected, got %v", err)
	}

	// UserService guards: email-less X user cannot set password or delete without verified X reauth
	userRepo := newFakeUserRepo(userXOnly, userWithPw)
	userSvc := NewUserService(userRepo)

	if err := userSvc.UpdatePassword(ctx, userXOnlyID, "", "Pass1234"); !errors.Is(err, ErrEmailRequiredForPassword) {
		t.Fatalf("expected ErrEmailRequiredForPassword, got %v", err)
	}
	if err := userSvc.DeleteAccount(ctx, userXOnlyID, "", "", ""); !errors.Is(err, ErrReauthRequired) {
		t.Fatalf("expected ErrReauthRequired without reauth, got %v", err)
	}
	if err := userSvc.DeleteAccount(ctx, userXOnlyID, "", "", verifiedXID); err != nil {
		t.Fatalf("DeleteAccount with verified X ID failed: %v", err)
	}
	if !userRepo.deleted[userXOnlyID] {
		t.Fatal("expected userXOnlyID to be deleted")
	}
}

