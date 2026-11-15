package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type CreditStateRow struct {
	ID              uuid.UUID
	Status          string
	CreditScore     int32
	CreditCount     int32
	HighCreditSince sql.NullTime
	LowCreditSince  sql.NullTime
}

type RecalculateCreditParams struct {
	ID               uuid.UUID
	MinVotes         int32
	PromoteThreshold int32
	DeleteThreshold  int32
}

const upsertEventCreditVote = `-- name: UpsertEventCreditVote :exec
INSERT INTO event_credit_votes (user_id, event_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, event_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
`

func (q *Queries) UpsertEventCreditVote(ctx context.Context, userID, eventID uuid.UUID, score int32) error {
	_, err := q.db.ExecContext(ctx, upsertEventCreditVote, userID, eventID, score)
	return err
}

const deleteEventCreditVote = `-- name: DeleteEventCreditVote :exec
DELETE FROM event_credit_votes
WHERE user_id = $1 AND event_id = $2
`

func (q *Queries) DeleteEventCreditVote(ctx context.Context, userID, eventID uuid.UUID) error {
	_, err := q.db.ExecContext(ctx, deleteEventCreditVote, userID, eventID)
	return err
}

const getUserEventCreditVote = `-- name: GetUserEventCreditVote :one
SELECT score FROM event_credit_votes
WHERE user_id = $1 AND event_id = $2 LIMIT 1
`

func (q *Queries) GetUserEventCreditVote(ctx context.Context, userID, eventID uuid.UUID) (int32, error) {
	var score int32
	err := q.db.QueryRowContext(ctx, getUserEventCreditVote, userID, eventID).Scan(&score)
	return score, err
}

const recalculateEventCredit = `-- name: RecalculateEventCredit :one
UPDATE events
SET
    credit_score = COALESCE((SELECT SUM(score)::int FROM event_credit_votes WHERE event_id = $1), 0),
    credit_count = COALESCE((SELECT COUNT(*)::int FROM event_credit_votes WHERE event_id = $1), 0),
    high_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM event_credit_votes WHERE event_id = $1), 0) >= $2::int
            AND COALESCE((SELECT SUM(score)::int FROM event_credit_votes WHERE event_id = $1), 0) >= $3::int
        THEN COALESCE(high_credit_since, NOW())
        ELSE NULL
    END,
    low_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM event_credit_votes WHERE event_id = $1), 0) >= $2::int
            AND COALESCE((SELECT SUM(score)::int FROM event_credit_votes WHERE event_id = $1), 0) <= $4::int
        THEN COALESCE(low_credit_since, NOW())
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, status, credit_score, credit_count, high_credit_since, low_credit_since
`

func (q *Queries) RecalculateEventCredit(ctx context.Context, arg RecalculateCreditParams) (CreditStateRow, error) {
	var i CreditStateRow
	err := q.db.QueryRowContext(ctx, recalculateEventCredit, arg.ID, arg.MinVotes, arg.PromoteThreshold, arg.DeleteThreshold).Scan(
		&i.ID, &i.Status, &i.CreditScore, &i.CreditCount, &i.HighCreditSince, &i.LowCreditSince,
	)
	return i, err
}

const upsertArtistCreditVote = `-- name: UpsertArtistCreditVote :exec
INSERT INTO artist_credit_votes (user_id, artist_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, artist_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
`

func (q *Queries) UpsertArtistCreditVote(ctx context.Context, userID, artistID uuid.UUID, score int32) error {
	_, err := q.db.ExecContext(ctx, upsertArtistCreditVote, userID, artistID, score)
	return err
}

const deleteArtistCreditVote = `-- name: DeleteArtistCreditVote :exec
DELETE FROM artist_credit_votes
WHERE user_id = $1 AND artist_id = $2
`

func (q *Queries) DeleteArtistCreditVote(ctx context.Context, userID, artistID uuid.UUID) error {
	_, err := q.db.ExecContext(ctx, deleteArtistCreditVote, userID, artistID)
	return err
}

const getUserArtistCreditVote = `-- name: GetUserArtistCreditVote :one
SELECT score FROM artist_credit_votes
WHERE user_id = $1 AND artist_id = $2 LIMIT 1
`

func (q *Queries) GetUserArtistCreditVote(ctx context.Context, userID, artistID uuid.UUID) (int32, error) {
	var score int32
	err := q.db.QueryRowContext(ctx, getUserArtistCreditVote, userID, artistID).Scan(&score)
	return score, err
}

const recalculateArtistCredit = `-- name: RecalculateArtistCredit :one
UPDATE artists
SET
    credit_score = COALESCE((SELECT SUM(score)::int FROM artist_credit_votes WHERE artist_id = $1), 0),
    credit_count = COALESCE((SELECT COUNT(*)::int FROM artist_credit_votes WHERE artist_id = $1), 0),
    high_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM artist_credit_votes WHERE artist_id = $1), 0) >= $2::int
            AND COALESCE((SELECT SUM(score)::int FROM artist_credit_votes WHERE artist_id = $1), 0) >= $3::int
        THEN COALESCE(high_credit_since, NOW())
        ELSE NULL
    END,
    low_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM artist_credit_votes WHERE artist_id = $1), 0) >= $2::int
            AND COALESCE((SELECT SUM(score)::int FROM artist_credit_votes WHERE artist_id = $1), 0) <= $4::int
        THEN COALESCE(low_credit_since, NOW())
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, status, credit_score, credit_count, high_credit_since, low_credit_since
`

func (q *Queries) RecalculateArtistCredit(ctx context.Context, arg RecalculateCreditParams) (CreditStateRow, error) {
	var i CreditStateRow
	err := q.db.QueryRowContext(ctx, recalculateArtistCredit, arg.ID, arg.MinVotes, arg.PromoteThreshold, arg.DeleteThreshold).Scan(
		&i.ID, &i.Status, &i.CreditScore, &i.CreditCount, &i.HighCreditSince, &i.LowCreditSince,
	)
	return i, err
}

const upsertVenueCreditVote = `-- name: UpsertVenueCreditVote :exec
INSERT INTO venue_credit_votes (user_id, venue_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, venue_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
`

func (q *Queries) UpsertVenueCreditVote(ctx context.Context, userID, venueID uuid.UUID, score int32) error {
	_, err := q.db.ExecContext(ctx, upsertVenueCreditVote, userID, venueID, score)
	return err
}

const deleteVenueCreditVote = `-- name: DeleteVenueCreditVote :exec
DELETE FROM venue_credit_votes
WHERE user_id = $1 AND venue_id = $2
`

func (q *Queries) DeleteVenueCreditVote(ctx context.Context, userID, venueID uuid.UUID) error {
	_, err := q.db.ExecContext(ctx, deleteVenueCreditVote, userID, venueID)
	return err
}

const getUserVenueCreditVote = `-- name: GetUserVenueCreditVote :one
SELECT score FROM venue_credit_votes
WHERE user_id = $1 AND venue_id = $2 LIMIT 1
`

func (q *Queries) GetUserVenueCreditVote(ctx context.Context, userID, venueID uuid.UUID) (int32, error) {
	var score int32
	err := q.db.QueryRowContext(ctx, getUserVenueCreditVote, userID, venueID).Scan(&score)
	return score, err
}

const recalculateVenueCredit = `-- name: RecalculateVenueCredit :one
UPDATE venues
SET
    credit_score = COALESCE((SELECT SUM(score)::int FROM venue_credit_votes WHERE venue_id = $1), 0),
    credit_count = COALESCE((SELECT COUNT(*)::int FROM venue_credit_votes WHERE venue_id = $1), 0),
    high_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM venue_credit_votes WHERE venue_id = $1), 0) >= $2::int
            AND COALESCE((SELECT SUM(score)::int FROM venue_credit_votes WHERE venue_id = $1), 0) >= $3::int
        THEN COALESCE(high_credit_since, NOW())
        ELSE NULL
    END,
    low_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM venue_credit_votes WHERE venue_id = $1), 0) >= $2::int
            AND COALESCE((SELECT SUM(score)::int FROM venue_credit_votes WHERE venue_id = $1), 0) <= $4::int
        THEN COALESCE(low_credit_since, NOW())
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, status, credit_score, credit_count, high_credit_since, low_credit_since
`

func (q *Queries) RecalculateVenueCredit(ctx context.Context, arg RecalculateCreditParams) (CreditStateRow, error) {
	var i CreditStateRow
	err := q.db.QueryRowContext(ctx, recalculateVenueCredit, arg.ID, arg.MinVotes, arg.PromoteThreshold, arg.DeleteThreshold).Scan(
		&i.ID, &i.Status, &i.CreditScore, &i.CreditCount, &i.HighCreditSince, &i.LowCreditSince,
	)
	return i, err
}

const promoteSustainedEvents = `-- name: PromoteSustainedEvents :exec
UPDATE events
SET status = 'APPROVED', high_credit_since = NULL, low_credit_since = NULL, updated_at = NOW()
WHERE status = 'PENDING'
  AND high_credit_since IS NOT NULL
  AND high_credit_since <= $1
`

func (q *Queries) PromoteSustainedEvents(ctx context.Context, cutoff time.Time) error {
	_, err := q.db.ExecContext(ctx, promoteSustainedEvents, cutoff)
	return err
}

const deleteSustainedLowCreditEvents = `-- name: DeleteSustainedLowCreditEvents :exec
DELETE FROM events
WHERE status = 'PENDING'
  AND low_credit_since IS NOT NULL
  AND low_credit_since <= $1
`

func (q *Queries) DeleteSustainedLowCreditEvents(ctx context.Context, cutoff time.Time) error {
	_, err := q.db.ExecContext(ctx, deleteSustainedLowCreditEvents, cutoff)
	return err
}

const promoteSustainedArtists = `-- name: PromoteSustainedArtists :exec
UPDATE artists
SET status = 'APPROVED', high_credit_since = NULL, low_credit_since = NULL, updated_at = NOW()
WHERE status = 'PENDING'
  AND high_credit_since IS NOT NULL
  AND high_credit_since <= $1
`

func (q *Queries) PromoteSustainedArtists(ctx context.Context, cutoff time.Time) error {
	_, err := q.db.ExecContext(ctx, promoteSustainedArtists, cutoff)
	return err
}

const deleteSustainedLowCreditArtists = `-- name: DeleteSustainedLowCreditArtists :exec
DELETE FROM artists
WHERE status = 'PENDING'
  AND low_credit_since IS NOT NULL
  AND low_credit_since <= $1
`

func (q *Queries) DeleteSustainedLowCreditArtists(ctx context.Context, cutoff time.Time) error {
	_, err := q.db.ExecContext(ctx, deleteSustainedLowCreditArtists, cutoff)
	return err
}

const promoteSustainedVenues = `-- name: PromoteSustainedVenues :exec
UPDATE venues
SET status = 'APPROVED', high_credit_since = NULL, low_credit_since = NULL, updated_at = NOW()
WHERE status = 'PENDING'
  AND high_credit_since IS NOT NULL
  AND high_credit_since <= $1
`

func (q *Queries) PromoteSustainedVenues(ctx context.Context, cutoff time.Time) error {
	_, err := q.db.ExecContext(ctx, promoteSustainedVenues, cutoff)
	return err
}

const deleteSustainedLowCreditVenues = `-- name: DeleteSustainedLowCreditVenues :exec
DELETE FROM venues
WHERE status = 'PENDING'
  AND low_credit_since IS NOT NULL
  AND low_credit_since <= $1
`

func (q *Queries) DeleteSustainedLowCreditVenues(ctx context.Context, cutoff time.Time) error {
	_, err := q.db.ExecContext(ctx, deleteSustainedLowCreditVenues, cutoff)
	return err
}
