-- 생년월일(birth_date), 데뷔일(debut_date) 컬럼 제거 및 성별(gender)을 남성(MALE)/여성(FEMALE)으로 제한
ALTER TABLE artists
    DROP COLUMN IF EXISTS birth_date,
    DROP COLUMN IF EXISTS debut_date;

UPDATE artists
SET gender = 'FEMALE'
WHERE gender NOT IN ('MALE', 'FEMALE');

ALTER TABLE artists
    ADD CONSTRAINT chk_artists_gender CHECK (gender IN ('MALE', 'FEMALE'));

