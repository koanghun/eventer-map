CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR UNIQUE,
    display_name VARCHAR NOT NULL,
    password_hash VARCHAR,
    google_id VARCHAR UNIQUE,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Artists
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    official_name VARCHAR NOT NULL,
    hiragana VARCHAR,
    gender VARCHAR NOT NULL,
    profile_image_url VARCHAR,
    birth_date DATE,
    debut_date DATE,
    rating_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'PENDING',
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Venues
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    official_name VARCHAR NOT NULL,
    google_map_id VARCHAR NOT NULL,
    address VARCHAR NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    related_links TEXT[],
    capacity INTEGER,
    rating_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'PENDING',
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,
    venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
    opening_time TIMESTAMPTZ,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    related_links TEXT[],
    poster_image_url VARCHAR,
    rating_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'PENDING',
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event Artists (N:M)
CREATE TABLE event_artists (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, artist_id)
);

-- Event Attendances
CREATE TABLE event_attendances (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, event_id)
);

-- User Event Ratings
CREATE TABLE user_event_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    PRIMARY KEY (user_id, event_id)
);

-- Event Threads
CREATE TABLE event_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    recommend_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Thread Recommendations
CREATE TABLE thread_recommendations (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES event_threads(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, thread_id)
);

-- Event Histories
CREATE TABLE event_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    editor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    snapshot JSONB NOT NULL,
    report_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History Reports
CREATE TABLE history_reports (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    history_id UUID NOT NULL REFERENCES event_histories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, history_id)
);

-- Indexes

-- Venues: Spatial search
CREATE INDEX idx_venues_location ON venues (latitude, longitude);

-- Events: Time, Venue, Artists filtering
-- The user requested: 기간(하루 또는 이틀 이상) + 공연장 Ids + 출연자 Ids(옵션)
CREATE INDEX idx_events_start_time ON events (start_time);
CREATE INDEX idx_events_venue_id ON events (venue_id);
-- `event_artists` already has PK (event_id, artist_id). To filter by artist quickly, we can add index on artist_id
CREATE INDEX idx_event_artists_artist_id ON event_artists (artist_id);

-- Threads: Ordered by recommend_count
CREATE INDEX idx_event_threads_event_id_recommend ON event_threads (event_id, recommend_count DESC);
-- 자동완성(LIKE '검색어%') 속도 최적화를 위한 전용 B-Tree 인덱스
CREATE INDEX idx_artists_name_pattern ON artists (official_name varchar_pattern_ops);
CREATE INDEX idx_venues_name_pattern ON venues (official_name varchar_pattern_ops);
