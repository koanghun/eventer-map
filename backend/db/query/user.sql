-- name: CreateUser :one
INSERT INTO users (email, display_name, password_hash, google_id, x_id, x_username, is_email_verified)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: GetUserByGoogleID :one
SELECT * FROM users
WHERE google_id = $1 LIMIT 1;

-- name: GetUserByXID :one
SELECT * FROM users
WHERE x_id = $1 LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: UpdateUserBanStatus :exec
UPDATE users
SET is_banned = $2, updated_at = NOW()
WHERE id = $1;

-- name: CheckNicknameExists :one
SELECT EXISTS(SELECT 1 FROM users WHERE display_name = $1);

-- name: UpdateUserEmailVerifiedByEmail :exec
UPDATE users
SET is_email_verified = $2, updated_at = NOW()
WHERE email = $1;

-- name: UpdateUserProfile :one
UPDATE users
SET display_name = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users
SET password_hash = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserGoogleID :exec
UPDATE users
SET google_id = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserXAccount :exec
UPDATE users
SET x_id = $2, x_username = $3, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUnverifiedUserSignup :execrows
UPDATE users
SET display_name = $2, password_hash = $3
WHERE id = $1 AND is_email_verified = false;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;
