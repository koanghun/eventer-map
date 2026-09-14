-- name: FollowArtist :exec
INSERT INTO user_artist_follows (user_id, artist_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: UnfollowArtist :exec
DELETE FROM user_artist_follows
WHERE user_id = $1 AND artist_id = $2;

-- name: ListFollowingArtists :many
SELECT a.id, a.official_name, a.hiragana, a.gender, a.profile_image_url, a.birth_date, a.debut_date, a.rating_sum, a.rating_count, a.status, a.author_id, a.created_at, a.updated_at
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
SELECT DISTINCT e.id, e.title, e.venue_id, e.opening_time, e.start_time, e.end_time, e.related_links, e.poster_image_url, e.rating_sum, e.rating_count, e.status, e.author_id, e.created_at, e.updated_at
FROM events e
JOIN event_artists ea ON e.id = ea.event_id
JOIN user_artist_follows uaf ON ea.artist_id = uaf.artist_id
WHERE uaf.user_id = $1
ORDER BY e.start_time DESC
LIMIT $2 OFFSET $3;

-- name: UpdateLastArtistFeedCheckedAt :exec
UPDATE users
SET last_artist_feed_checked_at = NOW()
WHERE id = $1;

-- name: GetLastArtistFeedCheckedAt :one
SELECT last_artist_feed_checked_at FROM users WHERE id = $1;
