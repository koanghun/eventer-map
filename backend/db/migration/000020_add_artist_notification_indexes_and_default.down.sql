DROP INDEX IF EXISTS idx_events_active_created_at;

ALTER TABLE users
    ALTER COLUMN last_artist_feed_checked_at SET DEFAULT '1970-01-01 00:00:00+00';

