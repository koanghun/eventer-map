-- name: CreateEventThread :one
INSERT INTO event_threads (event_id, author_id, content)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListEventThreads :many
SELECT * FROM event_threads
WHERE event_id = @event_id
    AND (@cursor_recommend::int IS NULL OR recommend_count < @cursor_recommend)
ORDER BY recommend_count DESC, id ASC
LIMIT $1;

-- name: RecommendThread :exec
INSERT INTO thread_recommendations (user_id, thread_id)
VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: CancelRecommendThread :exec
DELETE FROM thread_recommendations
WHERE user_id = $1 AND thread_id = $2;

-- name: IncrementThreadRecommend :exec
UPDATE event_threads
SET recommend_count = recommend_count + sqlc.arg('amount')
WHERE id = sqlc.arg('id');
