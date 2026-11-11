package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	defaultXAuthorizeEndpoint = "https://x.com/i/oauth2/authorize"
	defaultXTokenEndpoint     = "https://api.x.com/2/oauth2/token"
	defaultXUserMeEndpoint    = "https://api.x.com/2/users/me"
)

var (
	ErrXOAuthNotConfigured = errors.New("X OAuth is not configured")
	ErrXOAuthTokenExchange = errors.New("failed to exchange X authorization code")
	ErrXOAuthUserFetch     = errors.New("failed to fetch X user profile")
)

// XUser represents the verified X account profile returned by GET /2/users/me.
type XUser struct {
	ID             string
	Name           string
	Username       string
	ConfirmedEmail string
}

// XOAuthClient implements X OAuth 2.0 Authorization Code Flow with PKCE.
type XOAuthClient struct {
	clientID          string
	clientSecret      string
	redirectURI       string
	requestEmail      bool
	authorizeEndpoint string
	tokenEndpoint     string
	userMeEndpoint    string
	httpClient        *http.Client
}

// NewXOAuthClientFromEnv creates an XOAuthClient from environment variables.
// Returns nil when required X OAuth credentials are not configured (fail-closed).
func NewXOAuthClientFromEnv() *XOAuthClient {
	clientID := strings.TrimSpace(os.Getenv("X_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("X_CLIENT_SECRET"))
	redirectURI := strings.TrimSpace(os.Getenv("X_REDIRECT_URI"))
	requestEmail := strings.EqualFold(strings.TrimSpace(os.Getenv("X_REQUEST_EMAIL")), "true")

	if clientID == "" || clientSecret == "" || redirectURI == "" {
		return nil
	}
	if !isValidRedirectURI(redirectURI) {
		log.Println("WARNING: X_REDIRECT_URI has an invalid scheme/host; disabling X OAuth client")
		return nil
	}

	return &XOAuthClient{
		clientID:          clientID,
		clientSecret:      clientSecret,
		redirectURI:       redirectURI,
		requestEmail:      requestEmail,
		authorizeEndpoint: defaultXAuthorizeEndpoint,
		tokenEndpoint:     defaultXTokenEndpoint,
		userMeEndpoint:    defaultXUserMeEndpoint,
		httpClient:        &http.Client{Timeout: 10 * time.Second},
	}
}

func isValidRedirectURI(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || !u.IsAbs() {
		return false
	}
	if u.Scheme == "https" {
		return u.Host != ""
	}
	if u.Scheme == "http" {
		host := u.Hostname()
		return host == "localhost" || host == "127.0.0.1"
	}
	return false
}

// IsConfigured reports whether the X OAuth client has valid server credentials.
func (c *XOAuthClient) IsConfigured() bool {
	return c != nil && c.clientID != "" && c.clientSecret != "" && c.redirectURI != ""
}

// GenerateState generates a cryptographically random 32-byte URL-safe state string.
func GenerateState() (string, error) {
	return generateRandomBase64URL(32)
}

// GeneratePKCE generates a PKCE code_verifier and S256 code_challenge per RFC 7636.
func GeneratePKCE() (verifier, challenge string, err error) {
	verifier, err = generateRandomBase64URL(32)
	if err != nil {
		return "", "", err
	}
	sum := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(sum[:])
	return verifier, challenge, nil
}

func generateRandomBase64URL(numBytes int) (string, error) {
	b := make([]byte, numBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// BuildAuthorizeURL constructs the X OAuth 2.0 authorization URL with PKCE.
func (c *XOAuthClient) BuildAuthorizeURL(state, codeChallenge string) (string, error) {
	if !c.IsConfigured() {
		return "", ErrXOAuthNotConfigured
	}
	if state == "" || codeChallenge == "" {
		return "", errors.New("state and codeChallenge are required")
	}

	scopes := []string{"users.read", "tweet.read"}
	if c.requestEmail {
		scopes = append(scopes, "users.email")
	}

	u, err := url.Parse(c.authorizeEndpoint)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("response_type", "code")
	q.Set("client_id", c.clientID)
	q.Set("redirect_uri", c.redirectURI)
	q.Set("scope", strings.Join(scopes, " "))
	q.Set("state", state)
	q.Set("code_challenge", codeChallenge)
	q.Set("code_challenge_method", "S256")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// ExchangeCode exchanges an authorization code and PKCE code_verifier for an X access token.
func (c *XOAuthClient) ExchangeCode(ctx context.Context, code, codeVerifier string) (string, error) {
	if !c.IsConfigured() {
		return "", ErrXOAuthNotConfigured
	}
	if code == "" || codeVerifier == "" {
		return "", ErrXOAuthTokenExchange
	}

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", c.redirectURI)
	form.Set("code_verifier", codeVerifier)
	form.Set("client_id", c.clientID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.tokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.SetBasicAuth(c.clientID, c.clientSecret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: request failed", ErrXOAuthTokenExchange)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", ErrXOAuthTokenExchange
	}
	if resp.StatusCode != http.StatusOK {
		log.Printf("X token exchange failed with status %d", resp.StatusCode)
		return "", ErrXOAuthTokenExchange
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil || tokenResp.AccessToken == "" {
		return "", ErrXOAuthTokenExchange
	}
	return tokenResp.AccessToken, nil
}

// FetchUser retrieves the authenticated X user's immutable ID and handle via GET /2/users/me.
func (c *XOAuthClient) FetchUser(ctx context.Context, accessToken string) (*XUser, error) {
	if !c.IsConfigured() {
		return nil, ErrXOAuthNotConfigured
	}
	if accessToken == "" {
		return nil, ErrXOAuthUserFetch
	}

	u, err := url.Parse(c.userMeEndpoint)
	if err != nil {
		return nil, err
	}
	if c.requestEmail {
		q := u.Query()
		q.Set("user.fields", "confirmed_email")
		u.RawQuery = q.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: request failed", ErrXOAuthUserFetch)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, ErrXOAuthUserFetch
	}
	if resp.StatusCode != http.StatusOK {
		log.Printf("X user info request failed with status %d", resp.StatusCode)
		return nil, ErrXOAuthUserFetch
	}

	var payload struct {
		Data struct {
			ID             string `json:"id"`
			Name           string `json:"name"`
			Username       string `json:"username"`
			ConfirmedEmail string `json:"confirmed_email"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, ErrXOAuthUserFetch
	}
	if payload.Data.ID == "" {
		return nil, ErrXOAuthUserFetch
	}

	return &XUser{
		ID:             payload.Data.ID,
		Name:           payload.Data.Name,
		Username:       payload.Data.Username,
		ConfirmedEmail: strings.TrimSpace(payload.Data.ConfirmedEmail),
	}, nil
}

