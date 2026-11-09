-- name: CreateArtist :one
INSERT INTO artists (official_name, hiragana, disambiguation, gender, profile_image_url, status, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetArtist :one
SELECT * FROM artists
WHERE id = $1 LIMIT 1;

-- name: ListArtists :many
SELECT * FROM artists a
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

-- name: CheckArtistInEvent :one
SELECT EXISTS(
    SELECT 1 FROM event_artists WHERE artist_id = $1
);
