-- name: CreateVenue :one
INSERT INTO venues (official_name, google_map_id, address, latitude, longitude, related_links, capacity, status, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetVenue :one
SELECT
    v.id,
    v.official_name,
    v.google_map_id,
    v.address,
    v.latitude,
    v.longitude,
    v.related_links,
    v.capacity,
    COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), v.rating_sum)::double precision AS rating_sum,
    COALESCE((
        SELECT NULLIF(COUNT(*)::int, 0)
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), v.rating_count)::int AS rating_count,
    v.status,
    v.author_id,
    v.created_at,
    v.updated_at,
    v.credit_score,
    v.credit_count
FROM venues v
WHERE v.id = $1 LIMIT 1;

-- name: GetVenueForUpdate :one
SELECT * FROM venues
WHERE id = $1 FOR UPDATE LIMIT 1;

-- name: ListVenuesByBoundingBox :many
SELECT
    v.id,
    v.official_name,
    v.google_map_id,
    v.address,
    v.latitude,
    v.longitude,
    v.related_links,
    v.capacity,
    COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), v.rating_sum)::double precision AS rating_sum,
    COALESCE((
        SELECT NULLIF(COUNT(*)::int, 0)
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), v.rating_count)::int AS rating_count,
    v.status,
    v.author_id,
    v.created_at,
    v.updated_at,
    v.credit_score,
    v.credit_count
FROM venues v
WHERE 
    v.latitude BETWEEN @min_lat AND @max_lat
    AND v.longitude BETWEEN @min_lon AND @max_lon
    AND (@status::varchar IS NULL OR v.status = @status)
    AND (@cursor_id::uuid IS NULL OR v.id > @cursor_id)
ORDER BY
    CASE
        WHEN COALESCE((SELECT COUNT(*) FROM events e WHERE e.venue_id = v.id AND e.rating_count > 0), 0) > 0
        THEN (SELECT AVG(e.rating_sum / e.rating_count) FROM events e WHERE e.venue_id = v.id AND e.rating_count > 0)
        WHEN v.rating_count > 0 THEN v.rating_sum / v.rating_count
        ELSE 0
    END DESC,
    v.id ASC
LIMIT $1;

-- name: SearchVenues :many
SELECT
    v.id,
    v.official_name,
    v.address,
    v.latitude,
    v.longitude,
    COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), v.rating_sum)::double precision AS rating_sum,
    COALESCE((
        SELECT NULLIF(COUNT(*)::int, 0)
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), v.rating_count)::int AS rating_count,
    v.status
FROM venues v
WHERE
    v.status != 'REJECTED'
    AND LOWER(v.official_name) LIKE LOWER(sqlc.arg('query')::varchar) || '%'
ORDER BY
    CASE WHEN v.status = 'APPROVED' THEN 0 ELSE 1 END,
    v.official_name ASC
LIMIT sqlc.arg('limit');

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

-- name: UpdateVenueCredit :exec
UPDATE venues
SET credit_score = credit_score + sqlc.arg('score_delta'),
    credit_count = credit_count + sqlc.arg('count_delta')
WHERE id = sqlc.arg('id');

-- name: CheckVenueInEvent :one
SELECT EXISTS(
    SELECT 1 FROM events WHERE venue_id = $1
);

-- name: GetUserVenueRating :one
SELECT score FROM user_venue_ratings
WHERE user_id = $1 AND venue_id = $2 LIMIT 1;

-- name: InsertUserVenueRating :exec
INSERT INTO user_venue_ratings (user_id, venue_id, score)
VALUES ($1, $2, $3);

-- name: UpdateUserVenueRating :exec
UPDATE user_venue_ratings
SET score = $3
WHERE user_id = $1 AND venue_id = $2;
