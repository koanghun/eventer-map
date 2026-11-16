package handler

import (
	"bytes"
	"database/sql"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/repository"
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

func newMultipartEventRequest(t *testing.T, fields map[string]string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range fields {
		if err := w.WriteField(k, v); err != nil {
			t.Fatalf("WriteField(%s): %v", k, err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("multipart Close: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/events", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

func TestParseEventMultipartInputOptionalTimes(t *testing.T) {
	authorID := uuid.New()
	venueID := uuid.New()

	t.Run("accepts date without openingTime, startTime, or endTime", func(t *testing.T) {
		req := newMultipartEventRequest(t, map[string]string{
			"title":   "Live Without Times",
			"venueId": venueID.String(),
			"date":    "2026-12-01",
		})
		input, errMsg := parseEventMultipartInput(req, authorID)
		if errMsg != "" {
			t.Fatalf("unexpected validation error: %s", errMsg)
		}
		if input.OpeningTime != nil {
			t.Fatalf("expected nil OpeningTime, got %v", input.OpeningTime)
		}
		wantStart := time.Date(2026, 12, 1, 0, 0, unsetTimeSentinelSecond, 0, eventDateLocation)
		wantEnd := time.Date(2026, 12, 1, 23, 59, unsetTimeSentinelSecond, 0, eventDateLocation)
		if !input.StartTime.Equal(wantStart) {
			t.Fatalf("expected StartTime=%v, got %v", wantStart, input.StartTime)
		}
		if !input.EndTime.Equal(wantEnd) {
			t.Fatalf("expected EndTime=%v, got %v", wantEnd, input.EndTime)
		}
	})

	t.Run("accepts explicit opening, start, and end times and truncates seconds", func(t *testing.T) {
		req := newMultipartEventRequest(t, map[string]string{
			"title":       "Timed Live",
			"venueId":     venueID.String(),
			"date":        "2026-12-01",
			"openingTime": "2026-12-01T17:30:59+09:00",
			"startTime":   "2026-12-01T18:00:59+09:00",
			"endTime":     "2026-12-01T21:00:59+09:00",
		})
		input, errMsg := parseEventMultipartInput(req, authorID)
		if errMsg != "" {
			t.Fatalf("unexpected validation error: %s", errMsg)
		}
		if input.OpeningTime == nil || input.OpeningTime.Second() != 0 {
			t.Fatalf("expected truncated OpeningTime, got %v", input.OpeningTime)
		}
		if input.StartTime.Second() != 0 || input.EndTime.Second() != 0 {
			t.Fatalf("expected truncated StartTime/EndTime, got start=%v end=%v", input.StartTime, input.EndTime)
		}
	})

	t.Run("rejects missing date and all time fields", func(t *testing.T) {
		req := newMultipartEventRequest(t, map[string]string{
			"title":   "Missing Date",
			"venueId": venueID.String(),
		})
		_, errMsg := parseEventMultipartInput(req, authorID)
		if errMsg == "" {
			t.Fatal("expected validation error when neither date nor time is given")
		}
	})
}

func TestMapEventTimeSerializationWithSentinel(t *testing.T) {
	eventID := uuid.New()
	venueID := uuid.New()
	sentinelStart := time.Date(2026, 12, 5, 0, 0, unsetTimeSentinelSecond, 0, eventDateLocation)
	sentinelEnd := time.Date(2026, 12, 5, 23, 59, unsetTimeSentinelSecond, 0, eventDateLocation)

	detailResp := mapEventDetailToResponse(&service.EventDetail{
		Event: repository.Event{
			ID:        eventID,
			Title:     "No Time Event",
			VenueID:   uuid.NullUUID{UUID: venueID, Valid: true},
			StartTime: sentinelStart,
			EndTime:   sentinelEnd,
			Status:    "PENDING",
		},
	})
	if detailResp.Date == nil || *detailResp.Date != "2026-12-05" {
		t.Fatalf("expected Date=2026-12-05, got %v", detailResp.Date)
	}
	if detailResp.OpeningTime != nil || detailResp.StartTime != nil || detailResp.EndTime != nil {
		t.Fatalf("expected nil OpeningTime/StartTime/EndTime, got opening=%v start=%v end=%v",
			detailResp.OpeningTime, detailResp.StartTime, detailResp.EndTime)
	}

	summaryResp := mapListEventRowToSummary(repository.ListEventsRow{
		ID:        eventID,
		Title:     "No Time Event",
		VenueID:   uuid.NullUUID{UUID: venueID, Valid: true},
		StartTime: sentinelStart,
		EndTime:   sentinelEnd,
		Status:    "PENDING",
	})
	if summaryResp.Date == nil || *summaryResp.Date != "2026-12-05" {
		t.Fatalf("expected summary Date=2026-12-05, got %v", summaryResp.Date)
	}
	if summaryResp.StartTime != nil || summaryResp.EndTime != nil {
		t.Fatalf("expected nil summary StartTime/EndTime, got start=%v end=%v",
			summaryResp.StartTime, summaryResp.EndTime)
	}

	realOpen := time.Date(2026, 12, 5, 17, 30, 0, 0, eventDateLocation)
	realStart := time.Date(2026, 12, 5, 18, 0, 0, 0, eventDateLocation)
	realEnd := time.Date(2026, 12, 5, 20, 30, 0, 0, eventDateLocation)
	timedResp := mapEventDetailToResponse(&service.EventDetail{
		Event: repository.Event{
			ID:          eventID,
			Title:       "Timed Event",
			VenueID:     uuid.NullUUID{UUID: venueID, Valid: true},
			OpeningTime: sql.NullTime{Time: realOpen, Valid: true},
			StartTime:   realStart,
			EndTime:     realEnd,
			Status:      "APPROVED",
		},
	})
	if timedResp.Date == nil || *timedResp.Date != "2026-12-05" {
		t.Fatalf("expected timed Date=2026-12-05, got %v", timedResp.Date)
	}
	if timedResp.OpeningTime == nil || !timedResp.OpeningTime.Equal(realOpen) ||
		timedResp.StartTime == nil || !timedResp.StartTime.Equal(realStart) ||
		timedResp.EndTime == nil || !timedResp.EndTime.Equal(realEnd) {
		t.Fatalf("expected explicit OpeningTime/StartTime/EndTime, got opening=%v start=%v end=%v",
			timedResp.OpeningTime, timedResp.StartTime, timedResp.EndTime)
	}
}

