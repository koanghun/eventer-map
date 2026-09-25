package service

import (
	"context"
	"database/sql"
	"errors"
	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

type ArtistService struct {
	repo *repository.Queries
	db   *sql.DB
}

func NewArtistService(repo *repository.Queries, db *sql.DB) *ArtistService {
	return &ArtistService{repo: repo, db: db}
}

func (s *ArtistService) ListArtists(ctx context.Context, limit int32, status string, nameKeyword string, cursorID uuid.UUID) ([]repository.Artist, error) {
	return s.repo.ListArtists(ctx, repository.ListArtistsParams{
		Limit:       limit,
		Status:      status,
		NameKeyword: nameKeyword,
		CursorID:    cursorID,
	})
}

func (s *ArtistService) GetArtist(ctx context.Context, id uuid.UUID) (*repository.Artist, error) {
	artist, err := s.repo.GetArtist(ctx, id)
	if err != nil {
		return nil, err
	}
	return &artist, nil
}

func (s *ArtistService) FollowArtist(ctx context.Context, userID, artistID uuid.UUID) error {
	return s.repo.FollowArtist(ctx, repository.FollowArtistParams{
		UserID:   userID,
		ArtistID: artistID,
	})
}

func (s *ArtistService) UnfollowArtist(ctx context.Context, userID, artistID uuid.UUID) error {
	return s.repo.UnfollowArtist(ctx, repository.UnfollowArtistParams{
		UserID:   userID,
		ArtistID: artistID,
	})
}

func (s *ArtistService) ListFollowingArtists(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]repository.Artist, error) {
	return s.repo.ListFollowingArtists(ctx, repository.ListFollowingArtistsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
}

func (s *ArtistService) ListArtistFollowers(ctx context.Context, artistID uuid.UUID, limit, offset int32) ([]repository.ListArtistFollowersRow, error) {
	return s.repo.ListArtistFollowers(ctx, repository.ListArtistFollowersParams{
		ArtistID: artistID,
		Limit:    limit,
		Offset:   offset,
	})
}

func (s *ArtistService) ListFollowingArtistEvents(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]repository.Event, error) {
	return s.repo.ListFollowingArtistEvents(ctx, repository.ListFollowingArtistEventsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
}

func (s *ArtistService) GetLastArtistFeedCheckedAt(ctx context.Context, userID uuid.UUID) (string, error) {
	checkedAt, err := s.repo.GetLastArtistFeedCheckedAt(ctx, userID)
	if err != nil {
		return "", err
	}
	return checkedAt.Format("2006-01-02T15:04:05Z07:00"), nil
}

func (s *ArtistService) UpdateLastArtistFeedCheckedAt(ctx context.Context, userID uuid.UUID) error {
	return s.repo.UpdateLastArtistFeedCheckedAt(ctx, userID)
}

// RateArtist handles voting and auto-approval
func (s *ArtistService) RateArtist(ctx context.Context, userID, artistID uuid.UUID, score int32) (*repository.Artist, error) {
	// 1. Get current artist to ensure it exists and is PENDING
	artist, err := s.repo.GetArtist(ctx, artistID)
	if err != nil {
		return nil, err
	}
	if artist.Status != "PENDING" {
		return nil, errors.New("artist is not pending")
	}

	// Begin transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	q := s.repo.WithTx(tx)

	// 2. Check if user already voted
	oldScore, err := q.GetUserArtistRating(ctx, repository.GetUserArtistRatingParams{
		UserID:   userID,
		ArtistID: artistID,
	})

	var scoreDelta float64
	var countDelta int32

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// New vote
			err = q.InsertUserArtistRating(ctx, repository.InsertUserArtistRatingParams{
				UserID:   userID,
				ArtistID: artistID,
				Score:    score,
			})
			if err != nil {
				return nil, err
			}
			scoreDelta = float64(score)
			countDelta = 1
		} else {
			return nil, err
		}
	} else {
		// Existing vote
		if oldScore == score {
			// No change
			return &artist, nil
		}
		err = q.UpdateUserArtistRating(ctx, repository.UpdateUserArtistRatingParams{
			UserID:   userID,
			ArtistID: artistID,
			Score:    score,
		})
		if err != nil {
			return nil, err
		}
		scoreDelta = float64(score - oldScore)
		countDelta = 0
	}

	// 3. Update Artist Rating
	err = q.UpdateArtistRating(ctx, repository.UpdateArtistRatingParams{
		ScoreDelta: scoreDelta,
		CountDelta: countDelta,
		ID:         artistID,
	})
	if err != nil {
		return nil, err
	}

	// 4. Auto-Approval logic
	newRatingSum := artist.RatingSum + scoreDelta
	newRatingCount := artist.RatingCount + countDelta

	newStatus := artist.Status
	if newRatingCount >= 10 {
		// (Sum + Count) / (2 * Count) >= 0.8  =>  Sum >= 0.6 * Count
		if newRatingSum >= 0.6*float64(newRatingCount) {
			newStatus = "APPROVED"
			_, err = q.UpdateArtist(ctx, repository.UpdateArtistParams{
				ID:     artistID,
				Status: sql.NullString{String: "APPROVED", Valid: true},
			})
			if err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	artist.RatingSum = newRatingSum
	artist.RatingCount = newRatingCount
	artist.Status = newStatus

	return &artist, nil
}

func (s *ArtistService) CanUpdateArtist(ctx context.Context, artistID, userID uuid.UUID, userRole string) error {
	artist, err := s.repo.GetArtist(ctx, artistID)
	if err != nil {
		return err
	}

	if artist.Status == "APPROVED" {
		if userRole != "ADMIN" {
			return errors.New("only admins can update approved artists")
		}
		return nil
	}

	// For PENDING status:
	// Check if associated with an event
	inEvent, err := s.repo.CheckArtistInEvent(ctx, artistID)
	if err != nil {
		return err
	}
	if inEvent {
		return errors.New("cannot update artist that is already associated with an event")
	}

	// Only author or admin can update
	if userRole != "ADMIN" && artist.AuthorID.UUID != userID {
		return errors.New("only the author or admin can update this artist")
	}

	return nil
}
