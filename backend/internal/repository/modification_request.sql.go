package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type CreateModificationRequestParams struct {
	EntityType   string
	EntityID     uuid.UUID
	AuthorID     uuid.NullUUID
	ProposedData []byte
	Reason       string
}

type ModificationRequestRow struct {
	ModificationRequest
	AuthorDisplayName sql.NullString
	MyTrustScore      int32
}

const createModificationRequest = `-- name: CreateModificationRequest :one
INSERT INTO modification_requests (entity_type, entity_id, author_id, proposed_data, reason)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, entity_type, entity_id, author_id, proposed_data, reason, status, trust_score, trust_count, high_trust_since, low_trust_since, resolved_at, created_at, updated_at
`

func (q *Queries) CreateModificationRequest(ctx context.Context, arg CreateModificationRequestParams) (ModificationRequest, error) {
	var i ModificationRequest
	err := q.db.QueryRowContext(ctx, createModificationRequest,
		arg.EntityType, arg.EntityID, arg.AuthorID, arg.ProposedData, arg.Reason,
	).Scan(
		&i.ID, &i.EntityType, &i.EntityID, &i.AuthorID, &i.ProposedData, &i.Reason,
		&i.Status, &i.TrustScore, &i.TrustCount, &i.HighTrustSince, &i.LowTrustSince,
		&i.ResolvedAt, &i.CreatedAt, &i.UpdatedAt,
	)
	return i, err
}

const getModificationRequest = `-- name: GetModificationRequest :one
SELECT
    mr.id, mr.entity_type, mr.entity_id, mr.author_id, mr.proposed_data, mr.reason,
    mr.status, mr.trust_score, mr.trust_count, mr.high_trust_since, mr.low_trust_since,
    mr.resolved_at, mr.created_at, mr.updated_at,
    u.display_name AS author_display_name
FROM modification_requests mr
LEFT JOIN users u ON mr.author_id = u.id
WHERE mr.id = $1 LIMIT 1
`

func (q *Queries) GetModificationRequest(ctx context.Context, id uuid.UUID) (ModificationRequestRow, error) {
	var i ModificationRequestRow
	err := q.db.QueryRowContext(ctx, getModificationRequest, id).Scan(
		&i.ID, &i.EntityType, &i.EntityID, &i.AuthorID, &i.ProposedData, &i.Reason,
		&i.Status, &i.TrustScore, &i.TrustCount, &i.HighTrustSince, &i.LowTrustSince,
		&i.ResolvedAt, &i.CreatedAt, &i.UpdatedAt, &i.AuthorDisplayName,
	)
	return i, err
}

type ListModificationRequestsByEntityParams struct {
	ViewerID   uuid.UUID
	EntityType string
	EntityID   uuid.UUID
	Status     string
}

const listModificationRequestsByEntity = `-- name: ListModificationRequestsByEntity :many
SELECT
    mr.id, mr.entity_type, mr.entity_id, mr.author_id, mr.proposed_data, mr.reason,
    mr.status, mr.trust_score, mr.trust_count, mr.high_trust_since, mr.low_trust_since,
    mr.resolved_at, mr.created_at, mr.updated_at,
    u.display_name AS author_display_name,
    COALESCE(v.score, 0)::int AS my_trust_score
FROM modification_requests mr
LEFT JOIN users u ON mr.author_id = u.id
LEFT JOIN modification_request_votes v ON v.request_id = mr.id AND v.user_id = $1::uuid
WHERE mr.entity_type = $2::varchar
  AND mr.entity_id = $3::uuid
  AND ($4::varchar = '' OR mr.status = $4)
ORDER BY mr.created_at DESC
`

func (q *Queries) ListModificationRequestsByEntity(ctx context.Context, arg ListModificationRequestsByEntityParams) ([]ModificationRequestRow, error) {
	rows, err := q.db.QueryContext(ctx, listModificationRequestsByEntity,
		arg.ViewerID, arg.EntityType, arg.EntityID, arg.Status,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ModificationRequestRow
	for rows.Next() {
		var i ModificationRequestRow
		if err := rows.Scan(
			&i.ID, &i.EntityType, &i.EntityID, &i.AuthorID, &i.ProposedData, &i.Reason,
			&i.Status, &i.TrustScore, &i.TrustCount, &i.HighTrustSince, &i.LowTrustSince,
			&i.ResolvedAt, &i.CreatedAt, &i.UpdatedAt, &i.AuthorDisplayName, &i.MyTrustScore,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	return items, rows.Err()
}

const deleteModificationRequest = `-- name: DeleteModificationRequest :exec
DELETE FROM modification_requests
WHERE id = $1
`

func (q *Queries) DeleteModificationRequest(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.ExecContext(ctx, deleteModificationRequest, id)
	return err
}

const markModificationRequestApplied = `-- name: MarkModificationRequestApplied :one
UPDATE modification_requests
SET status = 'APPLIED',
    high_trust_since = NULL,
    low_trust_since = NULL,
    resolved_at = NOW(),
    updated_at = NOW()
WHERE id = $1 AND status = 'PENDING'
RETURNING id, entity_type, entity_id, author_id, proposed_data, reason, status, trust_score, trust_count, high_trust_since, low_trust_since, resolved_at, created_at, updated_at
`

func (q *Queries) MarkModificationRequestApplied(ctx context.Context, id uuid.UUID) (ModificationRequest, error) {
	var i ModificationRequest
	err := q.db.QueryRowContext(ctx, markModificationRequestApplied, id).Scan(
		&i.ID, &i.EntityType, &i.EntityID, &i.AuthorID, &i.ProposedData, &i.Reason,
		&i.Status, &i.TrustScore, &i.TrustCount, &i.HighTrustSince, &i.LowTrustSince,
		&i.ResolvedAt, &i.CreatedAt, &i.UpdatedAt,
	)
	return i, err
}

const upsertModificationRequestVote = `-- name: UpsertModificationRequestVote :exec
INSERT INTO modification_request_votes (user_id, request_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, request_id)
DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
`

func (q *Queries) UpsertModificationRequestVote(ctx context.Context, userID, requestID uuid.UUID, score int32) error {
	_, err := q.db.ExecContext(ctx, upsertModificationRequestVote, userID, requestID, score)
	return err
}

const deleteModificationRequestVote = `-- name: DeleteModificationRequestVote :exec
DELETE FROM modification_request_votes
WHERE user_id = $1 AND request_id = $2
`

func (q *Queries) DeleteModificationRequestVote(ctx context.Context, userID, requestID uuid.UUID) error {
	_, err := q.db.ExecContext(ctx, deleteModificationRequestVote, userID, requestID)
	return err
}

type RecalculateTrustParams struct {
	ID              uuid.UUID
	MinVotes        int32
	ApplyThreshold  int32
	RejectThreshold int32
}

const recalculateModificationRequestTrust = `-- name: RecalculateModificationRequestTrust :one
UPDATE modification_requests
SET
    trust_score = COALESCE((SELECT SUM(score)::int FROM modification_request_votes WHERE request_id = $1), 0),
    trust_count = COALESCE((SELECT COUNT(*)::int FROM modification_request_votes WHERE request_id = $1), 0),
    high_trust_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM modification_request_votes WHERE request_id = $1), 0) >= $2::int
            AND COALESCE((SELECT SUM(score)::int FROM modification_request_votes WHERE request_id = $1), 0) >= $3::int
        THEN COALESCE(high_trust_since, NOW())
        ELSE NULL
    END,
    low_trust_since = CASE
        WHEN status = 'PENDING'
            AND COALESCE((SELECT COUNT(*)::int FROM modification_request_votes WHERE request_id = $1), 0) >= $2::int
            AND COALESCE((SELECT SUM(score)::int FROM modification_request_votes WHERE request_id = $1), 0) <= $4::int
        THEN COALESCE(low_trust_since, NOW())
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id = $1
RETURNING id, entity_type, entity_id, author_id, proposed_data, reason, status, trust_score, trust_count, high_trust_since, low_trust_since, resolved_at, created_at, updated_at
`

func (q *Queries) RecalculateModificationRequestTrust(ctx context.Context, arg RecalculateTrustParams) (ModificationRequest, error) {
	var i ModificationRequest
	err := q.db.QueryRowContext(ctx, recalculateModificationRequestTrust,
		arg.ID, arg.MinVotes, arg.ApplyThreshold, arg.RejectThreshold,
	).Scan(
		&i.ID, &i.EntityType, &i.EntityID, &i.AuthorID, &i.ProposedData, &i.Reason,
		&i.Status, &i.TrustScore, &i.TrustCount, &i.HighTrustSince, &i.LowTrustSince,
		&i.ResolvedAt, &i.CreatedAt, &i.UpdatedAt,
	)
	return i, err
}

const listSustainedHighTrustModificationRequests = `-- name: ListSustainedHighTrustModificationRequests :many
SELECT id, entity_type, entity_id, author_id, proposed_data, reason, status, trust_score, trust_count, high_trust_since, low_trust_since, resolved_at, created_at, updated_at
FROM modification_requests
WHERE status = 'PENDING'
  AND high_trust_since IS NOT NULL
  AND high_trust_since <= $1
`

func (q *Queries) ListSustainedHighTrustModificationRequests(ctx context.Context, cutoff time.Time) ([]ModificationRequest, error) {
	rows, err := q.db.QueryContext(ctx, listSustainedHighTrustModificationRequests, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []ModificationRequest
	for rows.Next() {
		var i ModificationRequest
		if err := rows.Scan(
			&i.ID, &i.EntityType, &i.EntityID, &i.AuthorID, &i.ProposedData, &i.Reason,
			&i.Status, &i.TrustScore, &i.TrustCount, &i.HighTrustSince, &i.LowTrustSince,
			&i.ResolvedAt, &i.CreatedAt, &i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	return items, rows.Err()
}

const deleteSustainedLowTrustModificationRequests = `-- name: DeleteSustainedLowTrustModificationRequests :exec
DELETE FROM modification_requests
WHERE status = 'PENDING'
  AND low_trust_since IS NOT NULL
  AND low_trust_since <= $1
`

func (q *Queries) DeleteSustainedLowTrustModificationRequests(ctx context.Context, cutoff time.Time) error {
	_, err := q.db.ExecContext(ctx, deleteSustainedLowTrustModificationRequests, cutoff)
	return err
}
