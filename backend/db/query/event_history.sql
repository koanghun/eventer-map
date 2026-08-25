-- name: CreateEventHistory :one
INSERT INTO event_histories (event_id, editor_id, snapshot)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListEventHistories :many
SELECT * FROM event_histories
WHERE event_id = @event_id
    AND (@cursor_created_at::timestamptz IS NULL OR created_at < @cursor_created_at)
ORDER BY created_at DESC
LIMIT $1;

-- name: ReportHistory :exec
INSERT INTO history_reports (user_id, history_id)
VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: IncrementHistoryReportCount :exec
UPDATE event_histories
SET report_count = report_count + 1
WHERE id = $1;

-- name: UpdateHistoryStatus :exec
UPDATE event_histories
SET status = $2
WHERE id = $1;
