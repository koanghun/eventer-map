package service

import (
"context"
"database/sql"
"errors"
"eventer-map-backend/internal/repository"
"github.com/google/uuid"
)

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

