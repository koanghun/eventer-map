package auth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

func TestGeneratePKCE(t *testing.T) {
	verifier, challenge, err := GeneratePKCE()
	if err != nil {
		t.Fatalf("GeneratePKCE failed: %v", err)
	}
	if len(verifier) < 43 {
		t.Fatalf("verifier too short: %d", len(verifier))
	}
	sum := sha256.Sum256([]byte(verifier))
	wantChallenge := base64.RawURLEncoding.EncodeToString(sum[:])
	if challenge != wantChallenge {
		t.Fatalf("challenge mismatch: got %s, want %s", challenge, wantChallenge)
	}
}

func TestBuildAuthorizeURL_DefaultNoEmailScope(t *testing.T) {
	client := &XOAuthClient{
		clientID:          "cid-123",
		clientSecret:      "sec-456",
		redirectURI:       "http://localhost:3000/auth/x/callback",
		requestEmail:      false,
		authorizeEndpoint: defaultXAuthorizeEndpoint,
	}

	rawURL, err := client.BuildAuthorizeURL("state-abc", "challenge-xyz")
	if err != nil {
		t.Fatalf("BuildAuthorizeURL failed: %v", err)
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("invalid url: %v", err)
	}
	if u.Scheme != "https" || u.Host != "x.com" {
		t.Fatalf("unexpected origin: %s://%s", u.Scheme, u.Host)
	}
	q := u.Query()
	if q.Get("scope") != "users.read tweet.read" {
		t.Fatalf("unexpected scope: %q", q.Get("scope"))
	}
	if q.Get("code_challenge_method") != "S256" || q.Get("code_challenge") != "challenge-xyz" {
		t.Fatalf("unexpected PKCE params: %v", q)
	}
	if q.Get("state") != "state-abc" || q.Get("redirect_uri") != "http://localhost:3000/auth/x/callback" {
		t.Fatalf("unexpected state/redirect params: %v", q)
	}
}

func TestExchangeCodeAndFetchUser(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/2/oauth2/token":
			user, pass, ok := r.BasicAuth()
			if !ok || user != "cid-123" || pass != "sec-456" {
				t.Fatalf("expected Basic auth credentials, got ok=%v user=%s", ok, user)
			}
			if err := r.ParseForm(); err != nil {
				t.Fatal(err)
			}
			if r.Form.Get("code") != "auth-code" || r.Form.Get("code_verifier") != "verifier-1" {
				t.Fatalf("unexpected token form: %v", r.Form)
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "x-access-tok"})
		case "/2/users/me":
			if r.Header.Get("Authorization") != "Bearer x-access-tok" {
				t.Fatalf("missing bearer token: %s", r.Header.Get("Authorization"))
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]string{
					"id":       "987654321",
					"name":     "Eventer User",
					"username": "eventer_x",
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client := &XOAuthClient{
		clientID:       "cid-123",
		clientSecret:   "sec-456",
		redirectURI:    "http://localhost:3000/auth/x/callback",
		tokenEndpoint:  srv.URL + "/2/oauth2/token",
		userMeEndpoint: srv.URL + "/2/users/me",
		httpClient:     srv.Client(),
	}

	tok, err := client.ExchangeCode(context.Background(), "auth-code", "verifier-1")
	if err != nil {
		t.Fatalf("ExchangeCode failed: %v", err)
	}
	if tok != "x-access-tok" {
		t.Fatalf("unexpected token: %s", tok)
	}

	u, err := client.FetchUser(context.Background(), tok)
	if err != nil {
		t.Fatalf("FetchUser failed: %v", err)
	}
	if u.ID != "987654321" || u.Username != "eventer_x" || u.ConfirmedEmail != "" {
		t.Fatalf("unexpected XUser: %+v", u)
	}
}

func TestInMemoryOAuthStateStore_SingleUseAndExpiry(t *testing.T) {
	now := time.Unix(1700000000, 0).UTC()
	store := NewInMemoryOAuthStateStore()
	store.now = func() time.Time { return now }

	rawState := "random-state-123"
	hash := HashState(rawState)
	err := store.Save(context.Background(), OAuthState{
		StateHash:    hash,
		Provider:     ProviderX,
		Mode:         ModeLink,
		CodeVerifier: "pkce-verifier",
		UserID:       "user-uuid",
		ExpiresAt:    now.Add(10 * time.Minute),
	})
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	got, err := store.Consume(context.Background(), hash, ProviderX)
	if err != nil {
		t.Fatalf("Consume failed: %v", err)
	}
	if got.Mode != ModeLink || got.UserID != "user-uuid" || got.CodeVerifier != "pkce-verifier" {
		t.Fatalf("unexpected consumed state: %+v", got)
	}

	// Replay attempt must fail.
	if _, err := store.Consume(context.Background(), hash, ProviderX); !errors.Is(err, ErrOAuthStateNotFound) {
		t.Fatalf("expected ErrOAuthStateNotFound on replay, got %v", err)
	}

	// Expired entry must fail.
	hash2 := HashState("expired-state")
	_ = store.Save(context.Background(), OAuthState{
		StateHash:    hash2,
		Provider:     ProviderX,
		Mode:         ModeLogin,
		CodeVerifier: "v2",
		ExpiresAt:    now.Add(5 * time.Second),
	})
	now = now.Add(6 * time.Second)
	if _, err := store.Consume(context.Background(), hash2, ProviderX); !errors.Is(err, ErrOAuthStateNotFound) {
		t.Fatalf("expected ErrOAuthStateNotFound when expired, got %v", err)
	}
}

type mockDynamoClient struct {
	items map[string]map[string]types.AttributeValue
}

func (m *mockDynamoClient) PutItem(_ context.Context, params *dynamodb.PutItemInput, _ ...func(*dynamodb.Options)) (*dynamodb.PutItemOutput, error) {
	key := params.Item["state_hash"].(*types.AttributeValueMemberS).Value
	if _, exists := m.items[key]; exists {
		return nil, &types.ConditionalCheckFailedException{}
	}
	m.items[key] = params.Item
	return &dynamodb.PutItemOutput{}, nil
}

func (m *mockDynamoClient) DeleteItem(_ context.Context, params *dynamodb.DeleteItemInput, _ ...func(*dynamodb.Options)) (*dynamodb.DeleteItemOutput, error) {
	key := params.Key["state_hash"].(*types.AttributeValueMemberS).Value
	item, exists := m.items[key]
	if !exists {
		return nil, &types.ConditionalCheckFailedException{}
	}
	wantProvider := params.ExpressionAttributeValues[":p"].(*types.AttributeValueMemberS).Value
	gotProvider := item["provider"].(*types.AttributeValueMemberS).Value
	nowStr := params.ExpressionAttributeValues[":now"].(*types.AttributeValueMemberN).Value
	expStr := item["expires_at"].(*types.AttributeValueMemberN).Value
	if gotProvider != wantProvider || expStr <= nowStr {
		return nil, &types.ConditionalCheckFailedException{}
	}
	delete(m.items, key)
	return &dynamodb.DeleteItemOutput{Attributes: item}, nil
}

func TestDynamoDBOAuthStateStore_RoundTripAndFailClosed(t *testing.T) {
	now := time.Unix(1700000000, 0).UTC()
	mockClient := &mockDynamoClient{items: make(map[string]map[string]types.AttributeValue)}
	store := NewDynamoDBOAuthStateStore(mockClient, "oauth-states-test")
	store.now = func() time.Time { return now }

	hash := HashState("ddb-state")
	if err := store.Save(context.Background(), OAuthState{
		StateHash:    hash,
		Provider:     ProviderX,
		Mode:         ModeReauth,
		CodeVerifier: "ddb-verifier",
		UserID:       "user-1",
		ExpiresAt:    now.Add(10 * time.Minute),
	}); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	got, err := store.Consume(context.Background(), hash, ProviderX)
	if err != nil {
		t.Fatalf("Consume failed: %v", err)
	}
	if got.Mode != ModeReauth || got.UserID != "user-1" || got.CodeVerifier != "ddb-verifier" {
		t.Fatalf("unexpected state: %+v", got)
	}

	// Second consume must fail.
	if _, err := store.Consume(context.Background(), hash, ProviderX); !errors.Is(err, ErrOAuthStateNotFound) {
		t.Fatalf("expected ErrOAuthStateNotFound on replay, got %v", err)
	}

	// Non-local env without table name must fail closed.
	t.Setenv("ENV", "prod")
	t.Setenv("DYNAMODB_OAUTH_STATE_TABLE", "")
	if _, err := NewOAuthStateStoreFromEnv(context.Background()); !errors.Is(err, ErrOAuthStateStoreNotConfigured) {
		t.Fatalf("expected ErrOAuthStateStoreNotConfigured in prod without table, got %v", err)
	}

	// Confirm non-local redirect URI validation rejects http non-localhost.
	if isValidRedirectURI("http://evil.example.com/auth/x/callback") {
		t.Fatal("expected non-localhost http redirect URI to be rejected")
	}
	if !strings.HasPrefix("https://x.com/i/oauth2/authorize", "https://") {
		t.Fatal("unexpected constant")
	}
}

