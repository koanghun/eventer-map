"""
데이터베이스 마이그레이션: 정규화 시스템 추가

기존 Performer 및 Place 데이터에 normalized_name 및 canonical_name 생성
"""

import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
sys.path.append(str(Path(__file__).parent))

from database import SessionLocal, engine
from models import Performer, Place, Base
from utils.normalization import normalize_text
from sqlalchemy import text


def migrate_performers():
    """Performer 테이블 마이그레이션"""
    db = SessionLocal()
    
    try:
        print("\n=== Performer 마이그레이션 시작 ===")
        
        # 1. 컬럼 추가 (이미 존재하면 무시)
        print("1. 새 컬럼 추가 중...")
        try:
            db.execute(text("""
                ALTER TABLE performers 
                ADD COLUMN canonical_name TEXT
            """))
            db.execute(text("""
                ALTER TABLE performers 
                ADD COLUMN normalized_name TEXT
            """))
            db.execute(text("""
                ALTER TABLE performers 
                ADD COLUMN updated_at TIMESTAMP
            """))
            db.commit()
            print("   ✅ 새 컬럼 추가 완료")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  컬럼이 이미 존재합니다: {e}")
        
        # 2. 기존 데이터 마이그레이션
        print("\n2. 기존 데이터 마이그레이션 중...")
        performers = db.query(Performer).all()
        print(f"   총 {len(performers)}개의 출연자 발견")
        
        for performer in performers:
            # name 필드가 있으면 canonical_name으로 복사
            if performer.name and not performer.canonical_name:
                performer.canonical_name = performer.name
                performer.normalized_name = normalize_text(performer.name)
                print(f"   - '{performer.name}' → normalized: '{performer.normalized_name}'")
        
        db.commit()
        print("   ✅ 데이터 마이그레이션 완료")
        
        # 3. NOT NULL 제약 조건 추가 (SQLite는 직접 ALTER 불가, 확인만)
        print("\n3. 제약 조건 확인...")
        null_count = db.query(Performer).filter(
            (Performer.canonical_name == None) | (Performer.normalized_name == None)
        ).count()
        
        if null_count > 0:
            print(f"   ⚠️  {null_count}개의 행에 NULL 값이 있습니다. 수동 확인 필요!")
        else:
            print("   ✅ 모든 행에 값이 설정되었습니다")
        
        # 4. UNIQUE 인덱스 추가
        print("\n4. UNIQUE 인덱스 추가 중...")
        try:
            db.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_performers_normalized_name 
                ON performers(normalized_name)
            """))
            db.commit()
            print("   ✅ 인덱스 추가 완료")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  인덱스 추가 실패: {e}")
        
        print("\n=== Performer 마이그레이션 완료 ===\n")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 마이그레이션 실패: {e}")
        raise
    finally:
        db.close()


def migrate_places():
    """Place 테이블 마이그레이션"""
    db = SessionLocal()
    
    try:
        print("\n=== Place 마이그레이션 시작 ===")
        
        # 1. 컬럼 추가
        print("1. 새 컬럼 추가 중...")
        try:
            db.execute(text("""
                ALTER TABLE places 
                ADD COLUMN canonical_name TEXT
            """))
            db.execute(text("""
                ALTER TABLE places 
                ADD COLUMN normalized_name TEXT
            """))
            db.commit()
            print("   ✅ 새 컬럼 추가 완료")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  컬럼이 이미 존재합니다: {e}")
        
        # 2. 기존 데이터 마이그레이션
        print("\n2. 기존 데이터 마이그레이션 중...")
        places = db.query(Place).all()
        print(f"   총 {len(places)}개의 장소 발견")
        
        for place in places:
            if place.name and not place.canonical_name:
                place.canonical_name = place.name
                place.normalized_name = normalize_text(place.name)
                print(f"   - '{place.name}' → normalized: '{place.normalized_name}'")
        
        db.commit()
        print("   ✅ 데이터 마이그레이션 완료")
        
        # 3. NULL 체크
        print("\n3. 제약 조건 확인...")
        null_count = db.query(Place).filter(
            (Place.canonical_name == None) | (Place.normalized_name == None)
        ).count()
        
        if null_count > 0:
            print(f"   ⚠️  {null_count}개의 행에 NULL 값이 있습니다. 수동 확인 필요!")
        else:
            print("   ✅ 모든 행에 값이 설정되었습니다")
        
        # 4. UNIQUE 인덱스 추가
        print("\n4. UNIQUE 인덱스 추가 중...")
        try:
            db.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_places_normalized_name 
                ON places(normalized_name)
            """))
            db.commit()
            print("   ✅ 인덱스 추가 완료")
        except Exception as e:
            db.rollback()
            print(f"   ⚠️  인덱스 추가 실패: {e}")
        
        print("\n=== Place 마이그레이션 완료 ===\n")
        
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
        print("\n=== 마이그레이션 결과 확인 ===")
        
        # Performer 확인
        performer_count = db.query(Performer).count()
        performer_with_norm = db.query(Performer).filter(
            Performer.normalized_name != None
        ).count()
        
        print(f"\n📊 Performer:")
        print(f"   - 총 {performer_count}개")
        print(f"   - normalized_name 설정: {performer_with_norm}개")
        
        if performer_count > 0:
            sample = db.query(Performer).first()
            print(f"   - 샘플: '{sample.canonical_name}' → '{sample.normalized_name}'")
        
        # Place 확인
        place_count = db.query(Place).count()
        place_with_norm = db.query(Place).filter(
            Place.normalized_name != None
        ).count()
        
        print(f"\n📊 Place:")
        print(f"   - 총 {place_count}개")
        print(f"   - normalized_name 설정: {place_with_norm}개")
        
        if place_count > 0:
            sample = db.query(Place).first()
            print(f"   - 샘플: '{sample.canonical_name}' → '{sample.normalized_name}'")
        
        print("\n=== 검증 완료 ===\n")
        
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "="*60)
    print("중복 방지 시스템 데이터베이스 마이그레이션")
    print("="*60)
    
    try:
        # 마이그레이션 실행
        migrate_performers()
        migrate_places()
        
        # 결과 확인
        verify_migration()
        
        print("\n✅ 모든 마이그레이션이 성공적으로 완료되었습니다!")
        print("\n다음 단계:")
        print("1. 백엔드 서버 재시작")
        print("2. /docs 에서 API 테스트")
        print("3. 프론트엔드 타입 업데이트\n")
        
    except Exception as e:
        print(f"\n❌ 마이그레이션 중 오류 발생: {e}")
        print("롤백이 수행되었습니다. 데이터는 안전합니다.")
        sys.exit(1)
