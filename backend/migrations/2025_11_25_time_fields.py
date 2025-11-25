#!/usr/bin/env python3
"""
데이터베이스 마이그레이션 스크립트
event_time 필드를 door_time, start_time, end_time으로 분리
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'eventer.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 1. 새 컬럼 추가 (이미 있으면 에러 무시)
        print("Adding new columns...")
        try:
            cursor.execute("ALTER TABLE events ADD COLUMN door_time TEXT")
            print("✓ Added door_time column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ door_time column already exists")
            else:
                raise
        
        try:
            cursor.execute("ALTER TABLE events ADD COLUMN start_time TEXT")
            print("✓ Added start_time column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ start_time column already exists")
            else:
                raise
        
        try:
            cursor.execute("ALTER TABLE events ADD COLUMN end_time TEXT")
            print("✓ Added end_time column")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✓ end_time column already exists")
            else:
                raise
        
        # 2. 기존 event_time 데이터를 start_time으로 복사 (개연 시간으로 간주)
        print("\nMigrating existing data...")
        cursor.execute("""
            UPDATE events 
            SET start_time = event_time 
            WHERE event_time IS NOT NULL AND event_time != ''
        """)
        updated_rows = cursor.rowcount
        print(f"✓ Migrated {updated_rows} rows (event_time -> start_time)")
        
        # 3. 변경사항 커밋
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
        # 4. 결과 확인
        cursor.execute("SELECT id, title, event_time, door_time, start_time, end_time FROM events LIMIT 5")
        rows = cursor.fetchall()
        if rows:
            print("\nSample data after migration:")
            print("ID | Title | event_time | door_time | start_time | end_time")
            print("-" * 80)
            for row in rows:
                print(f"{row[0]} | {row[1][:20]} | {row[2]} | {row[3]} | {row[4]} | {row[5]}")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        print("Please create the database first by starting the backend server.")
        exit(1)
    
    print(f"Starting migration for database: {DB_PATH}\n")
    migrate()
