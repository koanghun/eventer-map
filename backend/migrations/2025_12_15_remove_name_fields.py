#!/usr/bin/env python3
"""
데이터베이스 마이그레이션 스크립트
Performer 및 Place 테이블에서 deprecated name 컬럼 제거
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'eventer.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("\n=== Step 3: name 컬럼 제거 마이그레이션 ===")
        
        # 1. Performer 테이블에서 name 컬럼 제거
        print("\n1. Performer 테이블에서 name 컬럼 제거 중...")
        try:
            cursor.execute("ALTER TABLE performers DROP COLUMN name")
            print("   ✅ Performer.name 컬럼 제거 완료")
        except sqlite3.OperationalError as e:
            if "no such column" in str(e):
                print("   ℹ️  Performer.name 컬럼이 이미 없습니다")
            else:
                raise
        
        # 2. Place 테이블에서 name 컬럼 제거
        print("\n2. Place 테이블에서 name 컬럼 제거 중...")
        try:
            cursor.execute("ALTER TABLE places DROP COLUMN name")
            print("   ✅ Place.name 컬럼 제거 완료")
        except sqlite3.OperationalError as e:
            if "no such column" in str(e):
                print("   ℹ️  Place.name 컬럼이 이미 없습니다")
            else:
                raise
        
        # 3. 변경사항 커밋
        conn.commit()
        print("\n✅ 마이그레이션 완료!")
        
        # 4. 결과 확인 - 테이블 구조 출력
        print("\n=== 테이블 구조 확인 ===")
        
        cursor.execute("PRAGMA table_info(performers)")
        print("\n📋 Performer 테이블 컬럼:")
        for col in cursor.fetchall():
            print(f"   - {col[1]} ({col[2]})")
        
        cursor.execute("PRAGMA table_info(places)")
        print("\n📋 Place 테이블 컬럼:")
        for col in cursor.fetchall():
            print(f"   - {col[1]} ({col[2]})")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 마이그레이션 실패: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print(f"❌ 데이터베이스를 찾을 수 없습니다: {DB_PATH}")
        print("백엔드 서버를 먼저 실행하여 데이터베이스를 생성하세요.")
        exit(1)
    
    print(f"데이터베이스: {DB_PATH}")
    
    # 확인 메시지
    print("\n⚠️  주의: 이 마이그레이션은 name 컬럼을 영구적으로 삭제합니다.")
    print("계속하시겠습니까? (y/N): ", end="")
    
    # 자동 실행을 위해 주석 처리 가능
    # response = input().strip().lower()
    # if response != 'y':
    #     print("마이그레이션이 취소되었습니다.")
    #     exit(0)
    
    migrate()
