package service

import (
	"context"
	"database/sql"
	"errors"
	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

type VenueService struct {
	repo *repository.Queries
	db   *sql.DB
}

func NewVenueService(repo *repository.Queries, db *sql.DB) *VenueService {
	return &VenueService{repo: repo, db: db}
}

func (s *VenueService) ListVenuesByBoundingBox(ctx context.Context, minLat, maxLat, minLng, maxLng float64, status, nameKeyword string) ([]repository.Venue, error) {
	return s.repo.ListVenuesByBoundingBox(ctx, repository.ListVenuesByBoundingBoxParams{
		MinLat:   minLat,
		MaxLat:   maxLat,
		MinLon:   minLng, // Map Lng to Lon
		MaxLon:   maxLng, // Map Lng to Lon
		Status:   status,
		CursorID: uuid.Nil,
	})
}

func (s *VenueService) GetVenue(ctx context.Context, id uuid.UUID) (*repository.Venue, error) {
	venue, err := s.repo.GetVenue(ctx, id)
	if err != nil {
		return nil, err
	}
	return &venue, nil
}

// RateVenue handles voting and auto-approval
func (s *VenueService) RateVenue(ctx context.Context, userID, venueID uuid.UUID, score int32) (*repository.Venue, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	q := s.repo.WithTx(tx)

	// 1. Get current venue inside transaction FOR UPDATE
	venue, err := q.GetVenueForUpdate(ctx, venueID)
	if err != nil {
		return nil, err
	}

	oldScore, err := q.GetUserVenueRating(ctx, repository.GetUserVenueRatingParams{
		UserID:  userID,
		VenueID: venueID,
	})

	var scoreDelta int32
	var countDelta int32

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			err = q.InsertUserVenueRating(ctx, repository.InsertUserVenueRatingParams{
				UserID:  userID,
				VenueID: venueID,
				Score:   score,
			})
			if err != nil {
				return nil, err
			}
			scoreDelta = score
			countDelta = 1
		} else {
			return nil, err
		}
	} else {
		if oldScore == score {
			return &venue, nil
		}
		err = q.UpdateUserVenueRating(ctx, repository.UpdateUserVenueRatingParams{
			UserID:  userID,
			VenueID: venueID,
			Score:   score,
		})
		if err != nil {
			return nil, err
		}
		scoreDelta = score - oldScore
		countDelta = 0
	}

	err = q.UpdateVenueCredit(ctx, repository.UpdateVenueCreditParams{
		ScoreDelta: scoreDelta,
		CountDelta: countDelta,
		ID:         venueID,
	})
	if err != nil {
		return nil, err
	}

	newCreditSum := venue.CreditScore + scoreDelta
	newCreditCount := venue.CreditCount + countDelta

	newStatus := venue.Status
	if newStatus == "PENDING" && newCreditCount >= 10 {
		if newCreditSum > 0 {
			newStatus = "APPROVED"
			_, err = q.UpdateVenue(ctx, repository.UpdateVenueParams{
				ID:     venueID,
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

	venue.CreditScore = newCreditSum
	venue.CreditCount = newCreditCount
	venue.Status = newStatus

	return &venue, nil
}

func (s *VenueService) CanUpdateVenue(ctx context.Context, venueID, userID uuid.UUID, userRole string) error {
	// ADMIN can always update
	if userRole == "ADMIN" {
		return nil
	}

	venue, err := s.repo.GetVenue(ctx, venueID)
	if err != nil {
		return err
	}

	if venue.Status == "APPROVED" {
		return errors.New("only admins can update approved venues directly. Users should use modification proposals")
	}

	// Only author can update their own PENDING venue
	if venue.AuthorID.UUID != userID {
		return errors.New("only the author or admin can update this venue")
	}

	return nil
}
