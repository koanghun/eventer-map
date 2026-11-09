-- 1. 미사용 이벤트 수정 이력 및 신고 테이블 제거
DROP TABLE IF EXISTS history_reports;
DROP TABLE IF EXISTS event_histories;

-- 2. 미사용 이벤트 포스터 이미지 URL 컬럼 제거
ALTER TABLE events
    DROP COLUMN IF EXISTS poster_image_url;

-- 3. 아티스트/공연장 자체 투표 테이블 및 신용점수(credit_score, credit_count) 컬럼 제거
DROP TABLE IF EXISTS user_artist_ratings;
DROP TABLE IF EXISTS user_venue_ratings;

ALTER TABLE artists
    DROP COLUMN IF EXISTS credit_score,
    DROP COLUMN IF EXISTS credit_count;

ALTER TABLE venues
    DROP COLUMN IF EXISTS credit_score,
    DROP COLUMN IF EXISTS credit_count;

-- 4. 아티스트/공연장 평점(rating_sum, rating_count)을 참가/개최 이벤트 평균 평점 기준으로 일원화 동기화
UPDATE venues v
SET
    rating_sum = COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), 0),
    rating_count = COALESCE((
        SELECT COUNT(*)::int
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), 0);

UPDATE artists a
SET
    rating_sum = COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM event_artists ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.artist_id = a.id AND e.rating_count > 0
    ), 0),
    rating_count = COALESCE((
        SELECT COUNT(*)::int
        FROM event_artists ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.artist_id = a.id AND e.rating_count > 0
    ), 0);

-- 5. 후속 함수형/복합 인덱스로 대체된 중복 인덱스 제거
DROP INDEX IF EXISTS idx_artists_name_pattern;
DROP INDEX IF EXISTS idx_venues_name_pattern;
DROP INDEX IF EXISTS idx_events_venue_id;

