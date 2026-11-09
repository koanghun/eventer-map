-- 이벤트 스레드(커뮤니티) 기능 활성화를 위한 스키마 보강

-- 1. 추천순 정렬 + 복합 커서 페이지네이션 (recommend_count DESC, created_at DESC, id DESC) 전용 인덱스
DROP INDEX IF EXISTS idx_event_threads_event_id_recommend;
CREATE INDEX idx_event_threads_event_ranking
    ON event_threads (event_id, recommend_count DESC, created_at DESC, id DESC);

-- 2. 유저 탈퇴 시 author_id SET NULL 처리 가속
CREATE INDEX idx_event_threads_author_id ON event_threads (author_id);

-- 3. 스레드 삭제 시 추천 CASCADE 삭제 가속 (PK는 user_id 선두라 thread_id 단독 조회 불가)
CREATE INDEX idx_thread_recommendations_thread_id ON thread_recommendations (thread_id);

-- 4. 추천 시각 기록
ALTER TABLE thread_recommendations
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 5. 본문 길이 제약 (기존 데이터 검증 없이 신규/수정 행부터 적용)
ALTER TABLE event_threads
    ADD CONSTRAINT chk_event_threads_content_length
    CHECK (char_length(content) BETWEEN 1 AND 1000) NOT VALID;

-- 6. 추천 수 음수 방지
ALTER TABLE event_threads
    ADD CONSTRAINT chk_event_threads_recommend_count_non_negative
    CHECK (recommend_count >= 0) NOT VALID;

