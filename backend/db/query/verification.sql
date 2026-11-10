-- name: CreateVerificationToken :one
INSERT INTO verification_tokens (email, code, expires_at, attempts)
VALUES ($1, $2, $3, 0)
ON CONFLICT (email) DO UPDATE 
SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, attempts = 0
RETURNING *;

-- name: GetVerificationTokenByEmail :one
SELECT * FROM verification_tokens
WHERE email = $1;

-- name: IncrementVerificationAttempts :one
UPDATE verification_tokens
SET attempts = attempts + 1
WHERE email = $1
RETURNING attempts;

-- name: DeleteVerificationToken :exec
DELETE FROM verification_tokens
WHERE email = $1;
