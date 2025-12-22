"""
Phase 5 마이그레이션: 즐겨찾기 이벤트 시스템 추가

User 테이블에 favorite_event_ids 컬럼 추가
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from database import SessionLocal
from models import User
from sqlalchemy import text


def migrate_favorites():
    """즐겨찾기 시스템 컬럼 추가"""
    db = SessionLocal()
    
    try:
        print("\n=== Phase 5: 즐겨찾기 시스템 마이그레이션 ===")
        
        # User 테이블에 컬럼 추가
        print("\n1. User 테이블 업데이트...")
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN favorite_event_ids TEXT DEFAULT '[]'"))
            db.commit()
            print("   ✅ User favorite_event_ids 컬럼 추가 완료")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  컬럼이 이미 존재합니다: {e}")
        
        # 기존 데이터에 빈 배열 설정
        print("\n2. 기존 데이터 초기화...")
        db.execute(text("UPDATE users SET favorite_event_ids = '[]' WHERE favorite_event_ids IS NULL"))
        db.commit()
        print("   ✅ 기존 데이터 초기화 완료")
        
        print("\n=== Phase 5 마이그레이션 완료 ===\n")
        
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
        
        # User 확인
        sample_user = db.query(User).first()
        if sample_user:
            print(f"\n📊 User 샘플:")
            print(f"   - email: {sample_user.email}")
            print(f"   - favorite_event_ids: {sample_user.favorite_event_ids}")
        
        print("\n=== 검증 완료 ===\n")
        
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Phase 5: 즐겨찾기 시스템 마이그레이션")
    print("="*60)
    
    try:
        migrate_favorites()
        verify_migration()
        
        print("\n✅ Phase 5 마이그레이션 성공!")
        print("\n다음 단계:")
        print("1. 백엔드 서버 재시작")
        print("2. 로그인 후 이벤트 즐겨찾기 테스트")
        print("3. 즐겨찾기 추가/제거 테스트\n")
        
    except Exception as e:
        print(f"\n❌ 마이그레이션 실패: {e}")
        sys.exit(1)
