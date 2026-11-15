-- 1. Add credit score & sustained lifecycle columns to events, artists, venues
ALTER TABLE events
    ADD COLUMN credit_score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN credit_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN high_credit_since TIMESTAMPTZ,
    ADD COLUMN low_credit_since TIMESTAMPTZ;

ALTER TABLE artists
    ADD COLUMN credit_score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN credit_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN high_credit_since TIMESTAMPTZ,
    ADD COLUMN low_credit_since TIMESTAMPTZ;

ALTER TABLE venues
    ADD COLUMN credit_score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN credit_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN high_credit_since TIMESTAMPTZ,
    ADD COLUMN low_credit_since TIMESTAMPTZ;

CREATE INDEX idx_events_pending_credit_lifecycle
    ON events (high_credit_since, low_credit_since)
    WHERE status = 'PENDING';

CREATE INDEX idx_artists_pending_credit_lifecycle
    ON artists (high_credit_since, low_credit_since)
    WHERE status = 'PENDING';

CREATE INDEX idx_venues_pending_credit_lifecycle
    ON venues (high_credit_since, low_credit_since)
    WHERE status = 'PENDING';

-- 2. Entity credit votes (+1 / -1)
CREATE TABLE event_credit_votes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, event_id)
);

CREATE TABLE artist_credit_votes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, artist_id)
);

CREATE TABLE venue_credit_votes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, venue_id)
);

-- 3. Modification requests for APPROVED (official) entities
CREATE TABLE modification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR NOT NULL CHECK (entity_type IN ('EVENT', 'ARTIST', 'VENUE')),
    entity_id UUID NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    proposed_data JSONB NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status VARCHAR NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPLIED')),
    trust_score INTEGER NOT NULL DEFAULT 0,
    trust_count INTEGER NOT NULL DEFAULT 0,
    high_trust_since TIMESTAMPTZ,
    low_trust_since TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mod_requests_entity
    ON modification_requests (entity_type, entity_id, status, created_at DESC);

CREATE INDEX idx_mod_requests_pending_trust
    ON modification_requests (high_trust_since, low_trust_since)
    WHERE status = 'PENDING';

CREATE TABLE modification_request_votes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES modification_requests(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, request_id)
);
