-- 이벤트 참가자(status = 2) 집계 및 조회 최적화를 위한 Partial Index (DS920+ NAS 메모리 및 I/O 절감)
CREATE INDEX IF NOT EXISTS idx_event_user_actions_event_attendees
ON event_user_actions (event_id)
WHERE status = 2;

-- 지도 Bounding Box 내 공연장(venue_id) 및 기간(start_time, end_time) 복합 필터링 인덱스
CREATE INDEX IF NOT EXISTS idx_events_time_venue
ON events (venue_id, start_time, end_time);

