-- 유저별 북마크(status = 1) / 참가(status = 2) 이벤트 목록 조회 최적화를 위한 복합 인덱스 (DS920+ NAS I/O 절감)
CREATE INDEX IF NOT EXISTS idx_event_user_actions_user_status_event
ON event_user_actions (user_id, status, event_id);

