-- name: CreateEvent :one
INSERT INTO events (title, venue_id, opening_time, start_time, end_time, related_links, poster_image_url, status, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetEvent :one
SELECT * FROM events
WHERE id = $1 LIMIT 1;

-- name: CountEventAttendees :one
SELECT COUNT(*)::int FROM event_user_actions
WHERE event_id = $1 AND status = 2;

-- name: GetEventForUpdate :one
SELECT * FROM events
WHERE id = $1 FOR UPDATE LIMIT 1;

-- name: RecalculateVenueRatingFromEvents :exec
UPDATE venues v
SET
    rating_sum = COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), 0),
    rating_count = COALESCE((
        SELECT COUNT(*)::int
        FROM events e
        WHERE e.venue_id = v.id AND e.rating_count > 0
    ), 0),
    updated_at = NOW()
WHERE v.id = $1;

-- name: RecalculateEventArtistsRatingFromEvents :exec
UPDATE artists a
SET
    rating_sum = COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM event_artists ea2
        JOIN events e ON ea2.event_id = e.id
        WHERE ea2.artist_id = a.id AND e.rating_count > 0
    ), 0),
    rating_count = COALESCE((
        SELECT COUNT(*)::int
        FROM event_artists ea2
        JOIN events e ON ea2.event_id = e.id
        WHERE ea2.artist_id = a.id AND e.rating_count > 0
    ), 0),
    updated_at = NOW()
WHERE a.id IN (
    SELECT ea.artist_id FROM event_artists ea WHERE ea.event_id = $1
);

-- name: RecalculateArtistRatingFromEvents :exec
UPDATE artists a
SET
    rating_sum = COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM event_artists ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.artist_id = a.id AND e.rating_count > 0
    ), 0),
    rating_count = COALESCE((
        SELECT COUNT(*)::int
        FROM event_artists ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.artist_id = a.id AND e.rating_count > 0
    ), 0),
    updated_at = NOW()
WHERE a.id = $1;

-- name: ListEvents :many
SELECT
    e.id,
    e.title,
    e.venue_id,
    COALESCE(v.official_name, '')::varchar AS venue_name,
    COALESCE(v.latitude, 0)::double precision AS latitude,
    COALESCE(v.longitude, 0)::double precision AS longitude,
    e.start_time,
    e.end_time,
    e.rating_sum,
    e.rating_count,
    (SELECT COUNT(*)::int FROM event_user_actions eua WHERE eua.event_id = e.id AND eua.status = 2) AS attendee_count,
    e.poster_image_url,
    e.status,
    COALESCE(ta.official_name, '')::varchar AS top_artist_name,
    COALESCE(ta.profile_image_url, '')::varchar AS top_artist_profile_image_url
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
LEFT JOIN LATERAL (
    SELECT
        a.official_name,
        a.profile_image_url,
        COALESCE((
            SELECT AVG(ev.rating_sum / ev.rating_count)
            FROM event_artists ea_sub
            JOIN events ev ON ea_sub.event_id = ev.id
            WHERE ea_sub.artist_id = a.id AND ev.rating_count > 0
        ), CASE WHEN a.rating_count > 0 THEN a.rating_sum / a.rating_count ELSE 0 END) AS artist_avg_rating
    FROM event_artists ea
    JOIN artists a ON ea.artist_id = a.id
    WHERE ea.event_id = e.id
    ORDER BY
        artist_avg_rating DESC,
        a.rating_count DESC,
        a.official_name ASC
    LIMIT 1
) ta ON true
WHERE
    (sqlc.narg('min_lat')::double precision IS NULL OR v.latitude >= sqlc.narg('min_lat'))
    AND (sqlc.narg('max_lat')::double precision IS NULL OR v.latitude <= sqlc.narg('max_lat'))
    AND (sqlc.narg('min_lng')::double precision IS NULL OR v.longitude >= sqlc.narg('min_lng'))
    AND (sqlc.narg('max_lng')::double precision IS NULL OR v.longitude <= sqlc.narg('max_lng'))
    AND (sqlc.narg('start_time_from')::timestamptz IS NULL OR e.end_time >= sqlc.narg('start_time_from'))
    AND (sqlc.narg('start_time_to')::timestamptz IS NULL OR e.start_time <= sqlc.narg('start_time_to'))
    AND (sqlc.narg('venue_id')::uuid IS NULL OR e.venue_id = sqlc.narg('venue_id'))
    AND (sqlc.narg('artist_id')::uuid IS NULL OR EXISTS (
        SELECT 1 FROM event_artists ea
        WHERE ea.event_id = e.id AND ea.artist_id = sqlc.narg('artist_id')
    ))
    AND (sqlc.narg('status')::varchar IS NULL OR e.status = sqlc.narg('status'))
ORDER BY attendee_count DESC, e.start_time ASC, e.id ASC
LIMIT sqlc.arg('limit');

-- name: UpdateEvent :one
UPDATE events
SET title = COALESCE(sqlc.narg('title'), title),
    venue_id = COALESCE(sqlc.narg('venue_id'), venue_id),
    opening_time = COALESCE(sqlc.narg('opening_time'), opening_time),
    start_time = COALESCE(sqlc.narg('start_time'), start_time),
    end_time = COALESCE(sqlc.narg('end_time'), end_time),
    related_links = COALESCE(sqlc.narg('related_links'), related_links),
    poster_image_url = COALESCE(sqlc.narg('poster_image_url'), poster_image_url),
    status = COALESCE(sqlc.narg('status'), status),
    updated_at = NOW()
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateEventRating :exec
UPDATE events
SET rating_sum = rating_sum + sqlc.arg('score_delta'),
    rating_count = rating_count + sqlc.arg('count_delta')
WHERE id = sqlc.arg('id');

-- name: AddArtistToEvent :exec
INSERT INTO event_artists (event_id, artist_id)
VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: ClearArtistsFromEvent :exec
DELETE FROM event_artists
WHERE event_id = $1;

-- name: GetArtistsForEvent :many
SELECT
    a.id,
    a.official_name,
    a.hiragana,
    a.gender,
    a.profile_image_url,
    COALESCE((
        SELECT SUM(e.rating_sum / e.rating_count)
        FROM event_artists ea2
        JOIN events e ON ea2.event_id = e.id
        WHERE ea2.artist_id = a.id AND e.rating_count > 0
    ), a.rating_sum)::double precision AS rating_sum,
    COALESCE((
        SELECT NULLIF(COUNT(*)::int, 0)
        FROM event_artists ea2
        JOIN events e ON ea2.event_id = e.id
        WHERE ea2.artist_id = a.id AND e.rating_count > 0
    ), a.rating_count)::int AS rating_count,
    a.status,
    a.author_id,
    a.created_at,
    a.updated_at,
    a.credit_score,
    a.credit_count,
    a.disambiguation
FROM artists a
JOIN event_artists ea ON a.id = ea.artist_id
WHERE ea.event_id = $1
ORDER BY
    CASE
        WHEN COALESCE((SELECT COUNT(*) FROM event_artists ea2 JOIN events e ON ea2.event_id = e.id WHERE ea2.artist_id = a.id AND e.rating_count > 0), 0) > 0
        THEN (SELECT AVG(e.rating_sum / e.rating_count) FROM event_artists ea2 JOIN events e ON ea2.event_id = e.id WHERE ea2.artist_id = a.id AND e.rating_count > 0)
        WHEN a.rating_count > 0 THEN a.rating_sum / a.rating_count
        ELSE 0
    END DESC,
    a.official_name ASC;

-- name: UpsertUserEventAction :exec
INSERT INTO event_user_actions (user_id, event_id, status)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, event_id)
DO UPDATE SET status = EXCLUDED.status;

-- name: DeleteUserEventAction :exec
DELETE FROM event_user_actions
WHERE user_id = $1 AND event_id = $2;

-- name: GetUserEventAction :one
SELECT status FROM event_user_actions
WHERE user_id = $1 AND event_id = $2 LIMIT 1;

-- name: ListUserEventActions :many
SELECT * FROM event_user_actions
WHERE user_id = $1
ORDER BY event_id;

-- name: RateEvent :exec
INSERT INTO user_event_ratings (user_id, event_id, score)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, event_id) DO UPDATE SET score = EXCLUDED.score;


-- name: GetUserRatingForEvent :one
SELECT * FROM user_event_ratings
WHERE user_id = $1 AND event_id = $2 LIMIT 1;

-- name: GetEventAttendees :many
SELECT u.id, u.email, u.display_name, u.created_at
FROM users u
JOIN event_user_actions eua ON u.id = eua.user_id
WHERE eua.event_id = $1 AND eua.status = 2
  AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE (ub.blocker_id = $2 AND ub.blocked_id = u.id)
         OR (ub.blocker_id = u.id AND ub.blocked_id = $2)
  )
ORDER BY u.created_at DESC
LIMIT $3 OFFSET $4;
