-- name: FollowArtist :exec
INSERT INTO user_artist_follows (user_id, artist_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: UnfollowArtist :exec
DELETE FROM user_artist_follows
WHERE user_id = $1 AND artist_id = $2;

-- name: ListFollowingArtists :many
SELECT a.*
FROM artists a
JOIN user_artist_follows uaf ON a.id = uaf.artist_id
WHERE uaf.user_id = $1
ORDER BY uaf.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListArtistFollowers :many
SELECT u.id, u.email, u.display_name, u.created_at
FROM users u
JOIN user_artist_follows uaf ON u.id = uaf.user_id
WHERE uaf.artist_id = $1
ORDER BY uaf.created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListFollowingArtistEvents :many
WITH matched_events AS (
    SELECT
        e.id,
        COALESCE(ARRAY_AGG(DISTINCT a.official_name ORDER BY a.official_name), '{}')::text[] AS matched_artist_names
    FROM events e
    JOIN event_artists ea ON e.id = ea.event_id
    JOIN user_artist_follows uaf ON ea.artist_id = uaf.artist_id
    JOIN artists a ON a.id = uaf.artist_id
    JOIN users u ON uaf.user_id = u.id
    WHERE uaf.user_id = sqlc.arg('user_id')
      AND e.status <> 'REJECTED'
      AND (
          NOT sqlc.arg('unread_only')::boolean
          OR (
              e.end_time >= NOW()
              AND e.author_id IS DISTINCT FROM u.id
              AND e.created_at > GREATEST(u.last_artist_feed_checked_at, uaf.created_at)
          )
      )
    GROUP BY e.id
)
SELECT
    e.id,
    e.title,
    e.venue_id,
    COALESCE(v.official_name, '')::varchar AS venue_name,
    COALESCE(v.latitude, 0)::double precision AS latitude,
    COALESCE(v.longitude, 0)::double precision AS longitude,
    e.start_time,
    e.end_time,
    e.created_at,
    e.rating_sum,
    e.rating_count,
    (SELECT COUNT(*)::int FROM event_user_actions eua WHERE eua.event_id = e.id AND eua.status = 2) AS attendee_count,
    e.status,
    COALESCE(ta.official_name, '')::varchar AS top_artist_name,
    COALESCE(ta.profile_image_url, '')::varchar AS top_artist_profile_image_url,
    me.matched_artist_names
FROM matched_events me
JOIN events e ON e.id = me.id
LEFT JOIN venues v ON e.venue_id = v.id
LEFT JOIN LATERAL (
    SELECT
        a.official_name,
        a.profile_image_url,
        CASE WHEN a.rating_count > 0 THEN a.rating_sum / a.rating_count ELSE 0 END AS artist_avg_rating
    FROM event_artists ea
    JOIN artists a ON ea.artist_id = a.id
    WHERE ea.event_id = e.id
    ORDER BY
        artist_avg_rating DESC,
        a.rating_count DESC,
        a.official_name ASC
    LIMIT 1
) ta ON true
ORDER BY e.created_at DESC, e.id ASC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: UpdateLastArtistFeedCheckedAt :exec
UPDATE users
SET last_artist_feed_checked_at = GREATEST(
    last_artist_feed_checked_at,
    LEAST(COALESCE(sqlc.narg('read_before')::timestamptz, NOW()), NOW())
)
WHERE id = sqlc.arg('id');

-- name: GetLastArtistFeedCheckedAt :one
SELECT last_artist_feed_checked_at, NOW()::timestamptz AS fetched_at
FROM users
WHERE id = $1;

-- name: CountUnreadFollowingArtistEvents :one
SELECT COUNT(DISTINCT e.id)
FROM events e
JOIN event_artists ea ON e.id = ea.event_id
JOIN user_artist_follows uaf ON ea.artist_id = uaf.artist_id
JOIN users u ON uaf.user_id = u.id
WHERE uaf.user_id = $1
  AND e.status <> 'REJECTED'
  AND e.end_time >= NOW()
  AND e.author_id IS DISTINCT FROM u.id
  AND e.created_at > GREATEST(u.last_artist_feed_checked_at, uaf.created_at);
