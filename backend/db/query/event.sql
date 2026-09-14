-- name: CreateEvent :one
INSERT INTO events (title, venue_id, opening_time, start_time, end_time, related_links, poster_image_url, status, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetEvent :one
SELECT * FROM events
WHERE id = $1 LIMIT 1;

-- name: ListEvents :many
SELECT * FROM events
WHERE 
    start_time >= @start_time_from
    AND start_time <= @start_time_to
    AND (@venue_id::uuid IS NULL OR venue_id = @venue_id)
    AND (@cursor_start_time::timestamptz IS NULL OR start_time > @cursor_start_time)
ORDER BY start_time ASC
LIMIT $1;

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
SELECT a.* FROM artists a
JOIN event_artists ea ON a.id = ea.artist_id
WHERE ea.event_id = $1;

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
