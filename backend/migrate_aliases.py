"""
Phase 2 마이그레이션: 별칭 시스템 추가

Performer 및 Place 테이블에 aliases 컬럼 추가
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent))

from database import SessionLocal
from models import Performer, Place
from sqlalchemy import text


def migrate_aliases():
    """별칭 시스템 컬럼 추가"""
    db = SessionLocal()
    
    try:
        print("\n=== Phase 2: 별칭 시스템 마이그레이션 ===")
        
        # Performer 테이블에 컬럼 추가
        print("\n1. Performer 테이블 업데이트...")
        try:
            db.execute(text("ALTER TABLE performers ADD COLUMN aliases TEXT DEFAULT '[]'"))
            db.commit()
            print("   ✅ Performer aliases 컬럼 추가 완료")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  컬럼이 이미 존재합니다: {e}")
        
        # Place 테이블에 컬럼 추가
        print("\n2. Place 테이블 업데이트...")
        try:
            db.execute(text("ALTER TABLE places ADD COLUMN aliases TEXT DEFAULT '[]'"))
            db.commit()
            print("   ✅ Place aliases 컬럼 추가 완료")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  컬럼이 이미 존재합니다: {e}")
        
        # 기존 데이터에 빈 배열 설정
        print("\n3. 기존 데이터 초기화...")
        db.execute(text("UPDATE performers SET aliases = '[]' WHERE aliases IS NULL"))
        db.execute(text("UPDATE places SET aliases = '[]' WHERE aliases IS NULL"))
        db.commit()
        print("   ✅ 기존 데이터 초기화 완료")
        
        print("\n=== Phase 2 마이그레이션 완료 ===\n")
        
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
        
        # Performer 확인
        sample_performer = db.query(Performer).first()
        if sample_performer:
            print(f"\n📊 Performer 샘플:")
            print(f"   - canonical_name: {sample_performer.canonical_name}")
            print(f"   - aliases: {sample_performer.aliases}")
        
        # Place 확인
        sample_place = db.query(Place).first()
        if sample_place:
            print(f"\n📊 Place 샘플:")
            print(f"   - canonical_name: {sample_place.canonical_name}")
            print(f"   - aliases: {sample_place.aliases}")
        
        print("\n=== 검증 완료 ===\n")
        
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Phase 2: 별칭 시스템 마이그레이션")
    print("="*60)
    
    try:
        migrate_aliases()
        verify_migration()
        
        print("\n✅ Phase 2 마이그레이션 성공!")
        print("\n다음 단계:")
        print("1. 백엔드 서버 재시작")
        print("2. 출연자 생성 시 별칭 테스트")
        print("3. 별칭으로 검색 테스트\n")
        
    except Exception as e:
        print(f"\n❌ 마이그레이션 실패: {e}")
        sys.exit(1)
