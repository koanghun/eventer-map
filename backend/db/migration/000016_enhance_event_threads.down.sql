ALTER TABLE event_threads
    DROP CONSTRAINT IF EXISTS chk_event_threads_recommend_count_non_negative;

ALTER TABLE event_threads
    DROP CONSTRAINT IF EXISTS chk_event_threads_content_length;

ALTER TABLE thread_recommendations
    DROP COLUMN IF EXISTS created_at;

DROP INDEX IF EXISTS idx_thread_recommendations_thread_id;
DROP INDEX IF EXISTS idx_event_threads_author_id;
DROP INDEX IF EXISTS idx_event_threads_event_ranking;

CREATE INDEX idx_event_threads_event_id_recommend
    ON event_threads (event_id, recommend_count DESC);

