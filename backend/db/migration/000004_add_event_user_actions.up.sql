ALTER TABLE event_attendances RENAME TO event_user_actions;
ALTER TABLE event_user_actions ADD COLUMN status INTEGER NOT NULL DEFAULT 0;
UPDATE event_user_actions SET status = 2 WHERE status = 0;
ALTER INDEX IF EXISTS event_attendances_pkey RENAME TO event_user_actions_pkey;
