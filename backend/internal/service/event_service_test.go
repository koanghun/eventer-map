package service

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestRateEventScoreValidation(t *testing.T) {
	svc := NewEventService(nil, nil)
	ctx := context.Background()
	eventID := uuid.New()
	userID := uuid.New()

	for _, score := range []int32{0, -1, 6, 10} {
		err := svc.RateEvent(ctx, eventID, userID, score)
		if err != ErrInvalidScore {
			t.Errorf("expected ErrInvalidScore for score %d, got %v", score, err)
		}
	}
}

