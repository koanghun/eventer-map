-- 대소문자 구분 없는 출연자(아티스트) 전방 일치(Prefix) 및 히라가나 자동완성 검색 속도 최적화를 위한 B-Tree 인덱스
CREATE INDEX IF NOT EXISTS idx_artists_lower_name_pattern
ON artists (LOWER(official_name) varchar_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_artists_hiragana_pattern
ON artists (hiragana varchar_pattern_ops);

