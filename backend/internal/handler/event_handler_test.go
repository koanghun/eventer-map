package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/service"
)

func TestGetEventsMyActionAuthAndValidation(t *testing.T) {
	srv := NewServer(&service.Services{
		Event: service.NewEventService(nil, nil),
	})
	mux := http.NewServeMux()
	HandlerFromMux(srv, mux)
	h := middleware.AuthMiddleware(mux)

	t.Run("rejects unauthenticated myAction request with 401", func(t *testing.T) {
		for _, action := range []string{"bookmarked", "attending"} {
			req := httptest.NewRequest(http.MethodGet, "/events?myAction="+action, nil)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("myAction=%s: expected 401, got %d (%s)", action, rec.Code, rec.Body.String())
			}
		}
	})

	t.Run("rejects unauthenticated followingArtists request with 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/events?followingArtists=true", nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("followingArtists=true: expected 401, got %d (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("rejects invalid myAction value with 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/events?myAction=invalid", nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for invalid myAction, got %d (%s)", rec.Code, rec.Body.String())
		}
	})

	t.Run("rejects conflicting filter combinations with 400", func(t *testing.T) {
		t.Setenv("JWT_SECRET", "test-handler-secret")
		tokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": uuid.NewString(),
		})
		token, err := tokenObj.SignedString(service.GetJWTSecret())
		if err != nil {
			t.Fatalf("failed to sign test JWT: %v", err)
		}

		cases := []string{
			"/events?followingArtists=true&myAction=bookmarked",
			"/events?followingArtists=true&artistId=" + uuid.NewString(),
			"/events?createdAfter=2026-11-12T00:00:00Z",
		}
		for _, path := range cases {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("Authorization", "Bearer "+token)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("%s: expected 400, got %d (%s)", path, rec.Code, rec.Body.String())
			}
		}
	})
}

func TestFollowingArtistNotificationAuthAndInputValidation(t *testing.T) {
	srv := NewServer(&service.Services{
		Artist: service.NewArtistService(nil, nil, nil),
	})
	mux := http.NewServeMux()
	HandlerFromMux(srv, mux)
	h := middleware.AuthMiddleware(mux)

	t.Run("rejects unauthenticated notification endpoints with 401", func(t *testing.T) {
		for _, tc := range []struct {
			method string
			path   string
		}{
			{http.MethodGet, "/users/me/following-artists/events?unreadOnly=true"},
			{http.MethodPost, "/users/me/following-artists/events/read"},
		} {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("%s %s: expected 401, got %d (%s)", tc.method, tc.path, rec.Code, rec.Body.String())
			}
		}
	})

	t.Run("rejects malformed JSON body on read endpoint with 400", func(t *testing.T) {
		t.Setenv("JWT_SECRET", "test-handler-secret")
		tokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": uuid.NewString(),
		})
		token, err := tokenObj.SignedString(service.GetJWTSecret())
		if err != nil {
			t.Fatalf("failed to sign test JWT: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/users/me/following-artists/events/read", strings.NewReader("{invalid"))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d (%s)", rec.Code, rec.Body.String())
		}
	})
}

