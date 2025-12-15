# Database Migrations

이 디렉토리는 데이터베이스 스키마 변경을 위한 마이그레이션 스크립트를 포함합니다.

## 📋 마이그레이션 목록

### 2025_11_25_time_fields.py
- **날짜**: 2025-11-25
- **설명**: 이벤트 시간 필드를 `event_time` 하나에서 `door_time`, `start_time`, `end_time` 3개로 분리
- **실행 여부**: 
  - ✅ 로컬 개발 환경 (2025-11-25)
  - ⬜ Synology NAS 프로덕션 환경

### 2025_11_26_normalization_system.py
- **날짜**: 2025-11-26
- **설명**: Performer 및 Place 테이블에 정규화 시스템 추가 (`canonical_name`, `normalized_name` 컬럼 및 UNIQUE 인덱스)
- **실행 여부**: 
  - ✅ 로컬 개발 환경 (2025-11-26)
  - ⬜ Synology NAS 프로덕션 환경

### 2025_12_05_alias_system.py
- **날짜**: 2025-12-05
- **설명**: Performer 및 Place 테이블에 별칭 시스템 추가 (`aliases` 컬럼)
- **실행 여부**: 
  - ✅ 로컬 개발 환경 (2025-12-05)
  - ⬜ Synology NAS 프로덕션 환경

## 🚀 마이그레이션 실행 방법

### 로컬 환경
```bash
cd backend
source venv/bin/activate
python migrations/2025_11_25_time_fields.py
# 또는
python migrations/2025_11_26_normalization_system.py
# 또는
python migrations/2025_12_05_alias_system.py
```

### Docker 환경
```bash
docker-compose exec backend python migrations/2025_11_25_time_fields.py
# 또는
docker-compose exec backend python migrations/2025_11_26_normalization_system.py
# 또는
docker-compose exec backend python migrations/2025_12_05_alias_system.py
```

## 📝 새 마이그레이션 추가 가이드

1. **파일명 규칙**: `YYYY_MM_DD_description.py`
   - 예: `2025_11_26_add_categories.py`

2. **파일 구조**:
```python
#!/usr/bin/env python3
"""
설명: 마이그레이션 목적 및 변경 사항
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'eventer.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 마이그레이션 로직
        cursor.execute("ALTER TABLE ...")
        conn.commit()
        print("✅ Migration completed successfully!")
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print(f"Starting migration for database: {DB_PATH}")
    migrate()
```

3. **실행 및 테스트**:
   - 로컬에서 먼저 테스트
   - README.md에 실행 여부 기록
   - 성공 후 Git 커밋

## ⚠️ 주의사항

- 마이그레이션은 **한 번만** 실행해야 합니다
- 실행 전 **데이터베이스 백업** 권장
- 프로덕션 환경에서는 특히 신중하게 실행
- 마이그레이션 실행 여부를 이 README에 기록하여 중복 실행 방지

## 🔄 롤백

현재 자동 롤백 기능은 없습니다. 필요 시:
1. 데이터베이스 백업에서 복원
2. 수동 롤백 스크립트 작성

## 📚 참고

- [SQLite ALTER TABLE 문법](https://www.sqlite.org/lang_altertable.html)
- SQLite는 일부 ALTER TABLE 제약사항이 있으므로 복잡한 스키마 변경 시 주의
