-- name: CreateVenue :one
INSERT INTO venues (official_name, google_map_id, address, latitude, longitude, related_links, capacity, status, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetVenue :one
SELECT * FROM venues
WHERE id = $1 LIMIT 1;

-- name: ListVenuesByBoundingBox :many
SELECT * FROM venues
WHERE 
    latitude BETWEEN @min_lat AND @max_lat
    AND longitude BETWEEN @min_lon AND @max_lon
    AND (@status::varchar IS NULL OR status = @status)
    AND (@cursor_id::uuid IS NULL OR id > @cursor_id)
ORDER BY id ASC
LIMIT $1;

-- name: UpdateVenue :one
UPDATE venues
SET official_name = COALESCE(sqlc.narg('official_name'), official_name),
    google_map_id = COALESCE(sqlc.narg('google_map_id'), google_map_id),
    address = COALESCE(sqlc.narg('address'), address),
    latitude = COALESCE(sqlc.narg('latitude'), latitude),
    longitude = COALESCE(sqlc.narg('longitude'), longitude),
    related_links = COALESCE(sqlc.narg('related_links'), related_links),
    capacity = COALESCE(sqlc.narg('capacity'), capacity),
    status = COALESCE(sqlc.narg('status'), status),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateVenueRating :exec
UPDATE venues
SET rating_sum = rating_sum + sqlc.arg('score_delta'),
    rating_count = rating_count + sqlc.arg('count_delta')
WHERE id = sqlc.arg('id');
