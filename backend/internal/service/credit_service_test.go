package service

import (
	"context"
	"errors"
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
