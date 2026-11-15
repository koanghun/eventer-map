DROP TABLE IF EXISTS modification_request_votes;
DROP TABLE IF EXISTS modification_requests;

DROP TABLE IF EXISTS venue_credit_votes;
DROP TABLE IF EXISTS artist_credit_votes;
DROP TABLE IF EXISTS event_credit_votes;

DROP INDEX IF EXISTS idx_venues_pending_credit_lifecycle;
DROP INDEX IF EXISTS idx_artists_pending_credit_lifecycle;
DROP INDEX IF EXISTS idx_events_pending_credit_lifecycle;

ALTER TABLE venues
    DROP COLUMN IF EXISTS credit_score,
    DROP COLUMN IF EXISTS credit_count,
    DROP COLUMN IF EXISTS high_credit_since,
    DROP COLUMN IF EXISTS low_credit_since;

ALTER TABLE artists
    DROP COLUMN IF EXISTS credit_score,
    DROP COLUMN IF EXISTS credit_count,
    DROP COLUMN IF EXISTS high_credit_since,
    DROP COLUMN IF EXISTS low_credit_since;

ALTER TABLE events
    DROP COLUMN IF EXISTS credit_score,
    DROP COLUMN IF EXISTS credit_count,
    DROP COLUMN IF EXISTS high_credit_since,
    DROP COLUMN IF EXISTS low_credit_since;
