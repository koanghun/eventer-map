-- 대소문자 구분 없는 공연장 전방 일치(Prefix) 자동완성 검색 속도 최적화를 위한 B-Tree 함수 인덱스
CREATE INDEX IF NOT EXISTS idx_venues_lower_name_pattern
ON venues (LOWER(official_name) varchar_pattern_ops);

