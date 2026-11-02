-- 동명이인 출연자(아티스트) 구분을 위한 한 줄 식별 설명(소속, 분야 등) 컬럼 추가
ALTER TABLE artists
    ADD COLUMN IF NOT EXISTS disambiguation VARCHAR(100);

