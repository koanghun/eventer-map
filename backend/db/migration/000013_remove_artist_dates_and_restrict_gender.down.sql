ALTER TABLE artists
    DROP CONSTRAINT IF EXISTS chk_artists_gender;

ALTER TABLE artists
    ADD COLUMN IF NOT EXISTS birth_date DATE,
    ADD COLUMN IF NOT EXISTS debut_date DATE;

