-- 1. 중복 인덱스 복원
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON events (venue_id);
CREATE INDEX IF NOT EXISTS idx_venues_name_pattern ON venues (official_name varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_artists_name_pattern ON artists (official_name varchar_pattern_ops);

-- 2. 아티스트/공연장 신용점수 컬럼 및 자체 투표 테이블 복원
ALTER TABLE venues
    ADD COLUMN IF NOT EXISTS credit_score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS credit_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE artists
    ADD COLUMN IF NOT EXISTS credit_score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS credit_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_venue_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score = 1 OR score = -1),
    PRIMARY KEY (user_id, venue_id)
);

CREATE TABLE IF NOT EXISTS user_artist_ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score = 1 OR score = -1),
    PRIMARY KEY (user_id, artist_id)
);

-- 3. 이벤트 포스터 이미지 URL 컬럼 복원
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS poster_image_url VARCHAR;

-- 4. 이벤트 수정 이력 및 신고 테이블 복원
CREATE TABLE IF NOT EXISTS event_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    editor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    snapshot JSONB NOT NULL,
    report_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS history_reports (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    history_id UUID NOT NULL REFERENCES event_histories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, history_id)
);

