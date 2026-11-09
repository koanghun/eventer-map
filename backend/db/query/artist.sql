-- name: CreateArtist :one
INSERT INTO artists (official_name, hiragana, disambiguation, gender, profile_image_url, status, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetArtist :one
SELECT
    a.id,
    a.official_name,
    a.hiragana,
    a.gender,
    a.profile_image_url,
    COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM event_artists ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.artist_id = a.id AND e.rating_count > 0
    ), a.rating_sum)::double precision AS rating_sum,
    COALESCE((
        SELECT NULLIF(COUNT(*)::int, 0)
        FROM event_artists ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.artist_id = a.id AND e.rating_count > 0
    ), a.rating_count)::int AS rating_count,
    a.status,
    a.author_id,
    a.created_at,
    a.updated_at,
    a.credit_score,
    a.credit_count,
    a.disambiguation
FROM artists a
WHERE a.id = $1 LIMIT 1;

-- name: GetArtistForUpdate :one
SELECT * FROM artists
WHERE id = $1 FOR UPDATE LIMIT 1;

-- name: ListArtists :many
SELECT
    a.id,
    a.official_name,
    a.hiragana,
    a.gender,
    a.profile_image_url,
    COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM event_artists ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.artist_id = a.id AND e.rating_count > 0
    ), a.rating_sum)::double precision AS rating_sum,
    COALESCE((
        SELECT NULLIF(COUNT(*)::int, 0)
        FROM event_artists ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.artist_id = a.id AND e.rating_count > 0
    ), a.rating_count)::int AS rating_count,
    a.status,
    a.author_id,
    a.created_at,
    a.updated_at,
    a.credit_score,
    a.credit_count,
    a.disambiguation
FROM artists a
WHERE 
    a.status != 'REJECTED'
    AND (@status::varchar = '' OR a.status = @status)
    AND (
        @name_keyword::varchar = ''
        OR LOWER(a.official_name) LIKE LOWER(@name_keyword) || '%'
        OR a.hiragana LIKE @name_keyword || '%'
    )
    AND (@cursor_id::uuid = '00000000-0000-0000-0000-000000000000'::uuid OR a.id > @cursor_id)
ORDER BY
    CASE WHEN a.status = 'APPROVED' THEN 0 ELSE 1 END,
    a.official_name ASC
LIMIT $1;

-- name: UpdateArtist :one
UPDATE artists
SET official_name = COALESCE(sqlc.narg('official_name'), official_name),
    hiragana = COALESCE(sqlc.narg('hiragana'), hiragana),
    disambiguation = COALESCE(sqlc.narg('disambiguation'), disambiguation),
    gender = COALESCE(sqlc.narg('gender'), gender),
    profile_image_url = COALESCE(sqlc.narg('profile_image_url'), profile_image_url),
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
