package service

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestThreadCursorRoundTrip(t *testing.T) {
	want := threadCursor{
		RecommendCount: 42,
		CreatedAt:      time.Date(2026, 11, 9, 7, 3, 9, 123456000, time.UTC),
		ID:             uuid.New(),
	}
	got, err := decodeThreadCursor(encodeThreadCursor(want))
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if got.RecommendCount != want.RecommendCount || !got.CreatedAt.Equal(want.CreatedAt) || got.ID != want.ID {
		t.Fatalf("round trip mismatch: got %+v, want %+v", got, want)
	}
}

func TestDecodeThreadCursorRejectsGarbage(t *testing.T) {
	cases := []string{
		"not-base64!!",
		"YWJj",                               // "abc"
		"LTF8MTIzfDAwMDAwMDAwLTAwMDAtMDAwMA", // negative count / bad uuid
		strings.Repeat("A", 300),
	}
	for _, c := range cases {
		if _, err := decodeThreadCursor(c); err == nil {
			t.Errorf("expected error for cursor %q", c)
		}
	}
}

func TestNormalizeThreadContent(t *testing.T) {
	if got, err := normalizeThreadContent("  hello\r\nworld  "); err != nil || got != "hello\nworld" {
		t.Fatalf("unexpected result: %q, %v", got, err)
	}
	if _, err := normalizeThreadContent("   \n "); err != ErrInvalidThreadContent {
		t.Fatalf("expected empty content error, got %v", err)
	}
	if _, err := normalizeThreadContent("a\x00b"); err != ErrInvalidThreadContent {
		t.Fatalf("expected NUL rejection, got %v", err)
	}
	// 멀티바이트 문자는 바이트가 아닌 글자 수로 계산
	if _, err := normalizeThreadContent(strings.Repeat("가", MaxThreadContentLength)); err != nil {
		t.Fatalf("1000 chars should be allowed: %v", err)
	}
	if _, err := normalizeThreadContent(strings.Repeat("가", MaxThreadContentLength+1)); err != ErrInvalidThreadContent {
		t.Fatalf("1001 chars should be rejected, got %v", err)
	}
}

