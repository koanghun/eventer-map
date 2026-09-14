-- name: FollowUser :exec
INSERT INTO user_follows (follower_id, followee_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: UnfollowUser :exec
DELETE FROM user_follows
WHERE follower_id = $1 AND followee_id = $2;

-- name: BlockUser :exec
INSERT INTO user_blocks (blocker_id, blocked_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: UnblockUser :exec
DELETE FROM user_blocks
WHERE blocker_id = $1 AND blocked_id = $2;

-- name: DeleteMutualFollows :exec
DELETE FROM user_follows
WHERE (follower_id = $1 AND followee_id = $2)
   OR (follower_id = $2 AND followee_id = $1);

-- name: CheckBlockExists :one
SELECT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = $1 AND blocked_id = $2)
       OR (blocker_id = $2 AND blocked_id = $1)
);

-- name: ListFollowing :many
SELECT u.id, u.email, u.display_name, u.created_at
FROM users u
JOIN user_follows uf ON u.id = uf.followee_id
WHERE uf.follower_id = $1
ORDER BY uf.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListFollowers :many
SELECT u.id, u.email, u.display_name, u.created_at
FROM users u
JOIN user_follows uf ON u.id = uf.follower_id
WHERE uf.followee_id = $1
ORDER BY uf.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListFollowingEvents :many
SELECT DISTINCT e.*
FROM events e
JOIN event_user_actions eua ON e.id = eua.event_id
JOIN user_follows uf ON eua.user_id = uf.followee_id
WHERE uf.follower_id = $1 AND eua.status = 2
ORDER BY e.start_time DESC
LIMIT $2 OFFSET $3;
