-- name: CreateModificationRequest :one
INSERT INTO modification_requests (entity_type, entity_id, author_id, proposed_data, reason)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetModificationRequest :one
SELECT
    mr.*,
    u.display_name AS author_display_name
FROM modification_requests mr
LEFT JOIN users u ON mr.author_id = u.id
WHERE mr.id = $1 LIMIT 1;

-- name: ListModificationRequestsByEntity :many
SELECT
    mr.*,
    u.display_name AS author_display_name,
    COALESCE(v.score, 0)::int AS my_trust_score
FROM modification_requests mr
LEFT JOIN users u ON mr.author_id = u.id
LEFT JOIN modification_request_votes v ON v.request_id = mr.id AND v.user_id = @viewer_id::uuid
WHERE mr.entity_type = @entity_type::varchar
  AND mr.entity_id = @entity_id::uuid
  AND (@status::varchar = '' OR mr.status = @status)
ORDER BY mr.created_at DESC;

-- name: DeleteModificationRequest :exec
DELETE FROM modification_requests
WHERE id = $1;

-- name: MarkModificationRequestApplied :one
UPDATE modification_requests
SET status = 'APPLIED',
    high_trust_since = NULL,
    low_trust_since = NULL,
    resolved_at = NOW(),
    updated_at = NOW()
WHERE id = $1 AND status = 'PENDING'
RETURNING *;

-- name: UpsertModificationRequestVote :exec
INSERT INTO modification_request_votes (user_id, request_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, request_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW();

-- name: DeleteModificationRequestVote :exec
DELETE FROM modification_request_votes
WHERE user_id = $1 AND request_id = $2;

-- name: RecalculateModificationRequestTrust :one
UPDATE modification_requests
SET
    trust_score = COALESCE((SELECT SUM(score)::int FROM modification_request_votes WHERE request_id = @id::uuid), 0),
    trust_count = COALESCE((SELECT COUNT(*)::int FROM modification_request_votes WHERE request_id = @id::uuid), 0),
    high_trust_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM modification_request_votes WHERE request_id = @id::uuid), 0) >= @min_votes::int
            AND COALESCE((SELECT SUM(score)::int FROM modification_request_votes WHERE request_id = @id::uuid), 0) >= @apply_threshold::int
        THEN COALESCE(high_trust_since, NOW())
        ELSE NULL
    END,
    low_trust_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM modification_request_votes WHERE request_id = @id::uuid), 0) >= @min_votes::int
            AND COALESCE((SELECT SUM(score)::int FROM modification_request_votes WHERE request_id = @id::uuid), 0) <= @reject_threshold::int
        THEN COALESCE(low_trust_since, NOW())
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id = @id::uuid
RETURNING *;

-- name: ListSustainedHighTrustModificationRequests :many
SELECT * FROM modification_requests
WHERE status = 'PENDING'
  AND high_trust_since IS NOT NULL
  AND high_trust_since <= $1;

-- name: DeleteSustainedLowTrustModificationRequests :exec
DELETE FROM modification_requests
WHERE status = 'PENDING'
  AND low_trust_since IS NOT NULL
  AND low_trust_since <= $1;

-- name: DeleteExpiredModificationRequests :exec
DELETE FROM modification_requests
WHERE status = 'PENDING'
  AND created_at <= $1;
