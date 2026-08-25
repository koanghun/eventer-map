-- name: CreateArtist :one
INSERT INTO artists (official_name, hiragana, gender, profile_image_url, birth_date, debut_date, status, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetArtist :one
SELECT * FROM artists
WHERE id = $1 LIMIT 1;

-- name: ListArtists :many
SELECT * FROM artists
WHERE 
    (@status::varchar IS NULL OR status = @status)
    AND (@name_keyword::varchar IS NULL OR official_name LIKE @name_keyword || '%')
    AND (@cursor_id::uuid IS NULL OR id > @cursor_id)
ORDER BY id ASC
LIMIT $1;

-- name: UpdateArtist :one
UPDATE artists
SET official_name = COALESCE(sqlc.narg('official_name'), official_name),
    hiragana = COALESCE(sqlc.narg('hiragana'), hiragana),
    gender = COALESCE(sqlc.narg('gender'), gender),
    profile_image_url = COALESCE(sqlc.narg('profile_image_url'), profile_image_url),
    birth_date = COALESCE(sqlc.narg('birth_date'), birth_date),
    debut_date = COALESCE(sqlc.narg('debut_date'), debut_date),
    status = COALESCE(sqlc.narg('status'), status),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateArtistRating :exec
UPDATE artists
SET rating_sum = rating_sum + sqlc.arg('score_delta'),
    rating_count = rating_count + sqlc.arg('count_delta')
WHERE id = sqlc.arg('id');
