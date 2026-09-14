-- name: IncrementDailyVisit :one
INSERT INTO daily_visits (visit_date, visit_count)
VALUES (CURRENT_DATE, 1)
ON CONFLICT (visit_date)
DO UPDATE SET visit_count = daily_visits.visit_count + 1
RETURNING visit_count;

-- name: GetDailyVisit :one
SELECT visit_count
FROM daily_visits
WHERE visit_date = CURRENT_DATE;
