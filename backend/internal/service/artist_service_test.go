package service

import (
	"context"
	"testing"
	"time"

	"eventer-map-backend/internal/repository"

	"github.com/google/uuid"
)

type fakeArtistFeedRepo struct {
	checkedRow  repository.GetLastArtistFeedCheckedAtRow
	eventRows   []repository.ListFollowingArtistEventsRow
	unreadCount int64
	listCalls   []repository.ListFollowingArtistEventsParams
	updateCalls []repository.UpdateLastArtistFeedCheckedAtParams
}

func (f *fakeArtistFeedRepo) GetLastArtistFeedCheckedAt(_ context.Context, _ uuid.UUID) (repository.GetLastArtistFeedCheckedAtRow, error) {
	return f.checkedRow, nil
}

func (f *fakeArtistFeedRepo) ListFollowingArtistEvents(_ context.Context, arg repository.ListFollowingArtistEventsParams) ([]repository.ListFollowingArtistEventsRow, error) {
	f.listCalls = append(f.listCalls, arg)
	return f.eventRows, nil
}

func (f *fakeArtistFeedRepo) CountUnreadFollowingArtistEvents(_ context.Context, _ uuid.UUID) (int64, error) {
	return f.unreadCount, nil
}

func (f *fakeArtistFeedRepo) UpdateLastArtistFeedCheckedAt(_ context.Context, arg repository.UpdateLastArtistFeedCheckedAtParams) error {
	f.updateCalls = append(f.updateCalls, arg)
	return nil
}

func TestArtistServiceGetFollowingArtistsEventFeedAndRead(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	checkedAt := time.Date(2026, 11, 10, 12, 0, 0, 100000000, time.UTC)
	fetchedAt := time.Date(2026, 11, 12, 6, 0, 0, 500000000, time.UTC)

	repo := &fakeArtistFeedRepo{
		checkedRow: repository.GetLastArtistFeedCheckedAtRow{
			LastArtistFeedCheckedAt: checkedAt,
			FetchedAt:               fetchedAt,
		},
		eventRows: []repository.ListFollowingArtistEventsRow{
			{
				ID:                 uuid.New(),
				Title:              "Budokan Live",
				VenueName:          "Nippon Budokan",
				Latitude:           35.6933,
				Longitude:          139.7498,
				StartTime:          fetchedAt.Add(48 * time.Hour),
				EndTime:            fetchedAt.Add(50 * time.Hour),
				CreatedAt:          fetchedAt.Add(-time.Hour),
				Status:             "APPROVED",
				TopArtistName:      "YOASOBI",
				MatchedArtistNames: []string{"YOASOBI"},
			},
		},
		unreadCount: 1,
	}

	svc := newArtistServiceWithFeedRepo(repo)
	res, err := svc.GetFollowingArtistsEventFeed(ctx, userID, true, 100, -5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(repo.listCalls) != 1 {
		t.Fatalf("expected 1 ListFollowingArtistEvents call, got %d", len(repo.listCalls))
	}
	if repo.listCalls[0].Limit != MaxArtistLimit || repo.listCalls[0].Offset != 0 || !repo.listCalls[0].UnreadOnly {
		t.Fatalf("unexpected normalized params: %+v", repo.listCalls[0])
	}
	if res.UnreadCount != 1 || !res.CheckedAt.Equal(checkedAt) || !res.FetchedAt.Equal(fetchedAt) || len(res.Events) != 1 {
		t.Fatalf("unexpected feed response: %+v", res)
	}

	readBefore := time.Date(2026, 11, 12, 15, 0, 0, 0, time.FixedZone("UTC+9", 9*3600))
	if err := svc.UpdateLastArtistFeedCheckedAt(ctx, userID, &readBefore); err != nil {
		t.Fatalf("UpdateLastArtistFeedCheckedAt failed: %v", err)
	}
	if len(repo.updateCalls) != 1 || !repo.updateCalls[0].ReadBefore.Valid || !repo.updateCalls[0].ReadBefore.Time.Equal(readBefore.UTC()) {
		t.Fatalf("unexpected readBefore param: %+v", repo.updateCalls)
	}
}

