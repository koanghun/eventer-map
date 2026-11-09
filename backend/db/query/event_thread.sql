-- name: CreateEventThread :one
INSERT INTO event_threads (event_id, author_id, content)
VALUES (@event_id, @author_id, @content)
RETURNING *;

-- name: GetEventThread :one
SELECT * FROM event_threads
WHERE id = @id
LIMIT 1;

-- name: GetEventThreadView :one
-- 단건 스레드 + 작성자 닉네임 + 조회자 추천 여부
SELECT
    t.id,
    t.event_id,
    t.author_id,
    t.content,
    t.recommend_count,
    t.created_at,
    t.updated_at,
    COALESCE(u.display_name, '')::text AS author_display_name,
    EXISTS (
        SELECT 1 FROM thread_recommendations r
        WHERE r.thread_id = t.id AND r.user_id = sqlc.narg('viewer_id')::uuid
    ) AS is_recommended
FROM event_threads t
LEFT JOIN users u ON u.id = t.author_id
WHERE t.id = @id
LIMIT 1;

-- name: ListEventThreads :many
-- 추천수 내림차순 → 최신순 → id 순 정렬, 복합 커서 기반 페이지네이션.
-- 조회자와 차단 관계에 있는 작성자의 스레드는 제외합니다.
SELECT
    t.id,
    t.event_id,
    t.author_id,
    t.content,
    t.recommend_count,
    t.created_at,
    t.updated_at,
    COALESCE(u.display_name, '')::text AS author_display_name,
    EXISTS (
        SELECT 1 FROM thread_recommendations r
        WHERE r.thread_id = t.id AND r.user_id = sqlc.narg('viewer_id')::uuid
    ) AS is_recommended
FROM event_threads t
LEFT JOIN users u ON u.id = t.author_id
WHERE t.event_id = @event_id
    AND (
        sqlc.narg('cursor_id')::uuid IS NULL
        OR (t.recommend_count, t.created_at, t.id) < (
            sqlc.narg('cursor_recommend_count')::int,
            sqlc.narg('cursor_created_at')::timestamptz,
            sqlc.narg('cursor_id')::uuid
        )
    )
    AND (
        sqlc.narg('viewer_id')::uuid IS NULL
        OR t.author_id IS NULL
        OR NOT EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = sqlc.narg('viewer_id')::uuid AND ub.blocked_id = t.author_id)
               OR (ub.blocker_id = t.author_id AND ub.blocked_id = sqlc.narg('viewer_id')::uuid)
        )
    )
ORDER BY t.recommend_count DESC, t.created_at DESC, t.id DESC
LIMIT @row_limit;

-- name: DeleteEventThread :execrows
DELETE FROM event_threads
WHERE id = @id;

-- name: InsertThreadRecommendation :execrows
INSERT INTO thread_recommendations (user_id, thread_id)
VALUES (@user_id, @thread_id)
ON CONFLICT DO NOTHING;

-- name: DeleteThreadRecommendation :execrows
DELETE FROM thread_recommendations
WHERE user_id = @user_id AND thread_id = @thread_id;

-- name: AddThreadRecommendCount :one
UPDATE event_threads
SET recommend_count = GREATEST(recommend_count + sqlc.arg('delta')::int, 0)
WHERE id = sqlc.arg('id')
RETURNING recommend_count;
