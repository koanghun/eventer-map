"""
Phase 6 마이그레이션: 즐겨찾기 → 이벤트 플래그 리네이밍

User 테이블의 favorite_event_ids 컬럼을 flagged_event_ids로 이름 변경
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from database import SessionLocal
from models import User
from sqlalchemy import text


def migrate_rename_favorites_to_flags():
    """즐겨찾기를 플래그로 컬럼명 변경"""
    db = SessionLocal()
    
    try:
        print("\n=== Phase 6: 즐겨찾기 → 플래그 리네이밍 마이그레이션 ===")
        
        # User 테이블 컬럼 이름 변경
        print("\n1. User 테이블 컬럼 이름 변경...")
        try:
            # SQLite는 RENAME COLUMN을 지원합니다 (SQLite 3.25.0+)
            db.execute(text("ALTER TABLE users RENAME COLUMN favorite_event_ids TO flagged_event_ids"))
            db.commit()
            print("   ✅ favorite_event_ids → flagged_event_ids 변경 완료")
        except Exception as e:
            db.rollback()
            if "no such column" in str(e).lower() or "duplicate column" in str(e).lower():
                print(f"   ⚠️  컬럼이 이미 변경되었거나 존재하지 않습니다: {e}")
            else:
                raise
        
        print("\n=== Phase 6 마이그레이션 완료 ===\n")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


def verify_migration():
    """마이그레이션 결과 확인"""
    db = SessionLocal()
    
    try:
        print("\n=== 검증 ===")
        
        # User 테이블 컬럼 확인
        result = db.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result]
        
        print(f"\n📊 User 테이블 컬럼 목록:")
        for col in columns:
            if 'flag' in col or 'favorite' in col:
                print(f"   - {col} {'✅' if 'flagged' in col else '❌'}")
        
        # 샘플 데이터 확인
        sample_user = db.query(User).first()
        if sample_user:
            print(f"\n📊 User 샘플:")
            print(f"   - email: {sample_user.email}")
            print(f"   - flagged_event_ids: {sample_user.flagged_event_ids}")
        
        print("\n=== 검증 완료 ===\n")
        
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Phase 6: 즐겨찾기 → 플래그 리네이밍 마이그레이션")
    print("="*60)
    
    try:
        migrate_rename_favorites_to_flags()
        verify_migration()
        
        print("\n✅ Phase 6 마이그레이션 성공!")
        print("\n다음 단계:")
        print("1. 백엔드 코드 업데이트 (models.py, schemas.py, routes)")
        print("2. 프론트엔드 코드 업데이트 (타입, 상태, UI)")
        print("3. 백엔드 서버 재시작")
        print("4. 플래그 기능 테스트\n")
        
    except Exception as e:
        print(f"\n❌ 마이그레이션 실패: {e}")
        sys.exit(1)
