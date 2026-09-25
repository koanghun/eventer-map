ALTER TABLE users ADD COLUMN role VARCHAR NOT NULL DEFAULT 'USER';

CREATE TABLE user_artist_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score = 1 OR score = -1),
    PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE user_venue_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score = 1 OR score = -1),
    PRIMARY KEY (user_id, venue_id)
);
