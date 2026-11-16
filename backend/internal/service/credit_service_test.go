package service

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCreditServiceConstants(t *testing.T) {
	if MinCreditVotes != 5 {
		t.Fatalf("expected MinCreditVotes=5, got %d", MinCreditVotes)
	}
	if PromoteScoreThreshold != 5 {
		t.Fatalf("expected PromoteScoreThreshold=5, got %d", PromoteScoreThreshold)
	}
	if DeleteScoreThreshold != -5 {
		t.Fatalf("expected DeleteScoreThreshold=-5, got %d", DeleteScoreThreshold)
	}
	if SustainedCreditDuration != 24*time.Hour {
		t.Fatalf("expected SustainedCreditDuration=24h, got %v", SustainedCreditDuration)
	}
	if MinTrustVotes != 5 || ApplyTrustThreshold != 5 || RejectTrustThreshold != -5 {
		t.Fatalf("unexpected trust thresholds: min=%d apply=%d reject=%d", MinTrustVotes, ApplyTrustThreshold, RejectTrustThreshold)
	}
	if SustainedTrustDuration != 0 {
		t.Fatalf("expected SustainedTrustDuration=0 for immediate apply/delete, got %v", SustainedTrustDuration)
	}
	if ModificationRequestTTL != 7*24*time.Hour {
		t.Fatalf("expected ModificationRequestTTL=7d, got %v", ModificationRequestTTL)
	}
}

func TestVoteEntityCreditRejectsInvalidScore(t *testing.T) {
	svc := NewCreditService(nil, nil)
	for _, bad := range []int32{2, -2, 99} {
		_, err := svc.VoteEntityCredit(context.Background(), "EVENT", uuid.New(), uuid.New(), bad)
		if !errors.Is(err, ErrInvalidCreditScore) {
			t.Fatalf("expected ErrInvalidCreditScore for %d, got %v", bad, err)
		}
	}
}

func TestSplitProposedDataFields(t *testing.T) {
	t.Run("splits EVENT multi-field update into independent items", func(t *testing.T) {
		venueID := uuid.NewString()
		a1 := uuid.NewString()
		a2 := uuid.NewString()

		items := splitProposedDataFields("EVENT", map[string]interface{}{
			"title":       "  수정된 타이틀1  ",
			"startTime":   "15:00",
			"venueId":     venueID,
			"venueName":   "Zepp Haneda",
			"artistIds":   []interface{}{a1, a2},
			"artistNames": []interface{}{"Artist A", "Artist B"},
		})

		if len(items) != 4 {
			t.Fatalf("expected 4 separated items, got %d: %+v", len(items), items)
		}
		if items[0]["title"] != "수정된 타이틀1" || len(items[0]) != 1 {
			t.Fatalf("unexpected item[0]: %+v", items[0])
		}
		if items[1]["startTime"] != "15:00" || len(items[1]) != 1 {
			t.Fatalf("unexpected item[1]: %+v", items[1])
		}
		if items[2]["venueId"] != venueID || items[2]["venueName"] != "Zepp Haneda" || len(items[2]) != 2 {
			t.Fatalf("unexpected item[2]: %+v", items[2])
		}
		if !reflect.DeepEqual(items[3]["artistIds"], []string{a1, a2}) || !reflect.DeepEqual(items[3]["artistNames"], []string{"Artist A", "Artist B"}) {
			t.Fatalf("unexpected item[3]: %+v", items[3])
		}
	})

	t.Run("splits ARTIST and VENUE fields independently", func(t *testing.T) {
		artistItems := splitProposedDataFields("ARTIST", map[string]interface{}{
			"officialName":   "Perfume",
			"hiragana":       "ぱふゅーむ",
			"disambiguation": "테크노 팝 유닛",
		})
		if len(artistItems) != 3 {
			t.Fatalf("expected 3 artist items, got %d", len(artistItems))
		}

		venueItems := splitProposedDataFields("VENUE", map[string]interface{}{
			"officialName": "Tokyo Dome",
			"address":      "Tokyo",
			"capacity":     float64(55000),
			"latitude":     35.7056,
			"longitude":    139.7519,
		})
		if len(venueItems) != 4 {
			t.Fatalf("expected 4 venue items (coordinates grouped), got %d: %+v", len(venueItems), venueItems)
		}
		if venueItems[2]["capacity"] != int32(55000) {
			t.Fatalf("expected capacity int32(55000), got %T(%v)", venueItems[2]["capacity"], venueItems[2]["capacity"])
		}
	})

	t.Run("returns empty slice when no valid fields exist", func(t *testing.T) {
		items := splitProposedDataFields("EVENT", map[string]interface{}{
			"title":   "   ",
			"unknown": "ignored",
		})
		if len(items) != 0 {
			t.Fatalf("expected 0 items, got %d: %+v", len(items), items)
		}
	})
}

func TestParseEventFieldTime(t *testing.T) {
	jst := time.FixedZone("UTC+9", 9*60*60)
	t1, err := parseEventFieldTime("15:00", 2026, 12, 1, jst)
	if err != nil {
		t.Fatalf("unexpected error for HH:mm: %v", err)
	}
	want := time.Date(2026, 12, 1, 15, 0, 0, 0, jst)
	if !t1.Equal(want) {
		t.Fatalf("expected %v, got %v", want, t1)
	}

	rfc := "2026-12-01T18:30:00+09:00"
	t2, err := parseEventFieldTime(rfc, 2026, 12, 1, jst)
	if err != nil {
		t.Fatalf("unexpected error for RFC3339: %v", err)
	}
	want2 := time.Date(2026, 12, 1, 18, 30, 0, 0, jst)
	if !t2.Equal(want2) {
		t.Fatalf("expected %v, got %v", want2, t2)
	}
}

func TestFilterNonDuplicateFieldItems(t *testing.T) {
	venueID := uuid.NewString()
	a1 := uuid.NewString()
	a2 := uuid.NewString()

	existingRaw := [][]byte{
		[]byte(`{"title":"수정된 타이틀1"}`),
		[]byte(`{"venueId":"` + venueID + `","venueName":"Tokyo Dome"}`),
		[]byte(`{"artistIds":["` + a1 + `","` + a2 + `"],"artistNames":["A","B"]}`),
	}

	t.Run("keeps only non-duplicate fields regardless of helper label keys or artist order", func(t *testing.T) {
		candidates := []map[string]interface{}{
			{"title": "수정된 타이틀1"},
			{"venueId": venueID}, // duplicate even without venueName
			{"artistIds": []string{a2, a1}, "artistNames": []string{"B", "A"}}, // duplicate regardless of order
			{"startTime": "15:00"}, // new field!
		}
		filtered := filterNonDuplicateFieldItems(candidates, existingRaw)
		if len(filtered) != 1 || filtered[0]["startTime"] != "15:00" {
			t.Fatalf("expected only startTime item to remain, got %+v", filtered)
		}
	})

	t.Run("returns empty slice when all items are duplicates", func(t *testing.T) {
		candidates := []map[string]interface{}{
			{"title": "  수정된 타이틀1  "},
		}
		filtered := filterNonDuplicateFieldItems(candidates, existingRaw)
		if len(filtered) != 0 {
			t.Fatalf("expected 0 items, got %+v", filtered)
		}
	})
}
