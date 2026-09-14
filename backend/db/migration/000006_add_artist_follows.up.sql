CREATE TABLE user_artist_follows (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, artist_id)
);

ALTER TABLE users ADD COLUMN last_artist_feed_checked_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00';
