ALTER INDEX IF EXISTS event_user_actions_pkey RENAME TO event_attendances_pkey;
ALTER TABLE event_user_actions DROP COLUMN status;
ALTER TABLE event_user_actions RENAME TO event_attendances;
