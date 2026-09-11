-- name: CreateVerificationToken :one
INSERT INTO verification_tokens (email, code, expires_at)
VALUES ($1, $2, $3)
ON CONFLICT (email) DO UPDATE 
SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at
RETURNING *;

-- name: GetVerificationToken :one
SELECT * FROM verification_tokens
WHERE email = $1 AND code = $2;

-- name: DeleteVerificationToken :exec
DELETE FROM verification_tokens
WHERE email = $1;
