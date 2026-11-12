-- 신규 유저의 팔로우 알림 기준 시각을 가입 시점(NOW())으로 설정하여 과거 이벤트 대량 미확인 노출 방지
ALTER TABLE users
    ALTER COLUMN last_artist_feed_checked_at SET DEFAULT NOW();

-- 기존 '1970-01-01' 기본값을 가진 사용자도 현재 시각으로 초기화
UPDATE users
SET last_artist_feed_checked_at = NOW()
WHERE last_artist_feed_checked_at = '1970-01-01 00:00:00+00';

-- 신규 이벤트 알림/필터 조회 시 created_at 기준 스캔 최적화를 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_events_active_created_at
ON events (created_at DESC, id)
WHERE status <> 'REJECTED';

