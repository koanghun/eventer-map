-- name: CreateUser :one
INSERT INTO users (email, display_name, password_hash, google_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: GetUserByGoogleID :one
SELECT * FROM users
WHERE google_id = $1 LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: UpdateUserBanStatus :exec
UPDATE users
SET is_banned = $2, updated_at = NOW()
WHERE id = $1;

-- name: CheckNicknameExists :one
SELECT EXISTS(SELECT 1 FROM users WHERE display_name = $1);

