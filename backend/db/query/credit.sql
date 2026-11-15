-- Event Credit Votes
-- name: UpsertEventCreditVote :exec
INSERT INTO event_credit_votes (user_id, event_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, event_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW();

-- name: DeleteEventCreditVote :exec
DELETE FROM event_credit_votes
WHERE user_id = $1 AND event_id = $2;

-- name: GetUserEventCreditVote :one
SELECT score FROM event_credit_votes
WHERE user_id = $1 AND event_id = $2 LIMIT 1;

-- name: RecalculateEventCredit :one
UPDATE events
SET
    credit_score = COALESCE((SELECT SUM(score)::int FROM event_credit_votes WHERE event_id = $1), 0),
    credit_count = COALESCE((SELECT COUNT(*)::int FROM event_credit_votes WHERE event_id = $1), 0),
    high_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM event_credit_votes WHERE event_id = $1), 0) >= @min_votes::int
            AND COALESCE((SELECT SUM(score)::int FROM event_credit_votes WHERE event_id = $1), 0) >= @promote_threshold::int
        THEN COALESCE(high_credit_since, NOW())
        ELSE NULL
    END,
    low_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM event_credit_votes WHERE event_id = $1), 0) >= @min_votes::int
            AND COALESCE((SELECT SUM(score)::int FROM event_credit_votes WHERE event_id = $1), 0) <= @delete_threshold::int
        THEN COALESCE(low_credit_since, NOW())
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, status, credit_score, credit_count, high_credit_since, low_credit_since;

-- Artist Credit Votes
-- name: UpsertArtistCreditVote :exec
INSERT INTO artist_credit_votes (user_id, artist_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, artist_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW();

-- name: DeleteArtistCreditVote :exec
DELETE FROM artist_credit_votes
WHERE user_id = $1 AND artist_id = $2;

-- name: GetUserArtistCreditVote :one
SELECT score FROM artist_credit_votes
WHERE user_id = $1 AND artist_id = $2 LIMIT 1;

-- name: RecalculateArtistCredit :one
UPDATE artists
SET
    credit_score = COALESCE((SELECT SUM(score)::int FROM artist_credit_votes WHERE artist_id = $1), 0),
    credit_count = COALESCE((SELECT COUNT(*)::int FROM artist_credit_votes WHERE artist_id = $1), 0),
    high_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM artist_credit_votes WHERE artist_id = $1), 0) >= @min_votes::int
            AND COALESCE((SELECT SUM(score)::int FROM artist_credit_votes WHERE artist_id = $1), 0) >= @promote_threshold::int
        THEN COALESCE(high_credit_since, NOW())
        ELSE NULL
    END,
    low_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM artist_credit_votes WHERE artist_id = $1), 0) >= @min_votes::int
            AND COALESCE((SELECT SUM(score)::int FROM artist_credit_votes WHERE artist_id = $1), 0) <= @delete_threshold::int
        THEN COALESCE(low_credit_since, NOW())
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, status, credit_score, credit_count, high_credit_since, low_credit_since;

-- Venue Credit Votes
-- name: UpsertVenueCreditVote :exec
INSERT INTO venue_credit_votes (user_id, venue_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, venue_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW();

-- name: DeleteVenueCreditVote :exec
DELETE FROM venue_credit_votes
WHERE user_id = $1 AND venue_id = $2;

-- name: GetUserVenueCreditVote :one
SELECT score FROM venue_credit_votes
WHERE user_id = $1 AND venue_id = $2 LIMIT 1;

-- name: RecalculateVenueCredit :one
UPDATE venues
SET
    credit_score = COALESCE((SELECT SUM(score)::int FROM venue_credit_votes WHERE venue_id = $1), 0),
    credit_count = COALESCE((SELECT COUNT(*)::int FROM venue_credit_votes WHERE venue_id = $1), 0),
    high_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM venue_credit_votes WHERE venue_id = $1), 0) >= @min_votes::int
            AND COALESCE((SELECT SUM(score)::int FROM venue_credit_votes WHERE venue_id = $1), 0) >= @promote_threshold::int
        THEN COALESCE(high_credit_since, NOW())
        ELSE NULL
    END,
    low_credit_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM venue_credit_votes WHERE venue_id = $1), 0) >= @min_votes::int
            AND COALESCE((SELECT SUM(score)::int FROM venue_credit_votes WHERE venue_id = $1), 0) <= @delete_threshold::int
        THEN COALESCE(low_credit_since, NOW())
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, status, credit_score, credit_count, high_credit_since, low_credit_since;

-- Sustained Lifecycle Transitions (Promote / Delete after sustained duration)
-- name: PromoteSustainedEvents :exec
UPDATE events
SET status = 'APPROVED', high_credit_since = NULL, low_credit_since = NULL, updated_at = NOW()
WHERE status = 'PENDING'
  AND high_credit_since IS NOT NULL
  AND high_credit_since <= $1;

-- name: DeleteSustainedLowCreditEvents :exec
DELETE FROM events
WHERE status = 'PENDING'
  AND low_credit_since IS NOT NULL
  AND low_credit_since <= $1;

-- name: PromoteSustainedArtists :exec
UPDATE artists
SET status = 'APPROVED', high_credit_since = NULL, low_credit_since = NULL, updated_at = NOW()
WHERE status = 'PENDING'
  AND high_credit_since IS NOT NULL
  AND high_credit_since <= $1;

-- name: DeleteSustainedLowCreditArtists :exec
DELETE FROM artists
WHERE status = 'PENDING'
  AND low_credit_since IS NOT NULL
  AND low_credit_since <= $1;

-- name: PromoteSustainedVenues :exec
UPDATE venues
SET status = 'APPROVED', high_credit_since = NULL, low_credit_since = NULL, updated_at = NOW()
WHERE status = 'PENDING'
  AND high_credit_since IS NOT NULL
  AND high_credit_since <= $1;

-- name: DeleteSustainedLowCreditVenues :exec
DELETE FROM venues
WHERE status = 'PENDING'
  AND low_credit_since IS NOT NULL
  AND low_credit_since <= $1;
