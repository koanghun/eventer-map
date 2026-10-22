-- name: CreateArtist :one
INSERT INTO artists (official_name, hiragana, gender, profile_image_url, birth_date, debut_date, status, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetArtist :one
SELECT * FROM artists
WHERE id = $1 LIMIT 1;

-- name: GetArtistForUpdate :one
SELECT * FROM artists
WHERE id = $1 FOR UPDATE LIMIT 1;

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

-- name: UpdateArtistCredit :exec
UPDATE artists
SET credit_score = credit_score + sqlc.arg('score_delta'),
    credit_count = credit_count + sqlc.arg('count_delta')
WHERE id = sqlc.arg('id');

-- name: CheckArtistInEvent :one
SELECT EXISTS(
    SELECT 1 FROM event_artists WHERE artist_id = $1
);

-- name: GetUserArtistRating :one
SELECT score FROM user_artist_ratings
WHERE user_id = $1 AND artist_id = $2 LIMIT 1;

-- name: InsertUserArtistRating :exec
INSERT INTO user_artist_ratings (user_id, artist_id, score)
VALUES ($1, $2, $3);

-- name: UpdateUserArtistRating :exec
UPDATE user_artist_ratings
SET score = $3
WHERE user_id = $1 AND artist_id = $2;
