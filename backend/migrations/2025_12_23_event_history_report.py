"""
데이터베이스 마이그레이션: 이벤트 히스토리 및 신고 시스템
- events 테이블에 created_by, updated_by, report_count, is_hidden 컬럼 추가
- users 테이블에 is_admin 컬럼 추가
- event_histories 테이블 생성
- event_reports 테이블 생성
"""

from sqlalchemy import create_engine, text
import sys
import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/eventer.db")
engine = create_engine(DATABASE_URL)

def run_migration():
    print("🚀 Starting migration: Event History & Report System...")
    
    with engine.begin() as conn:
        # 1. events 테이블에 추적 필드 추가
        print("  ➤ Adding tracking fields to events table...")
        try:
            conn.execute(text("ALTER TABLE events ADD COLUMN created_by INTEGER REFERENCES users(id)"))
        except Exception as e:
            print(f"    ⚠ created_by column may already exist: {e}")
        
        try:
            conn.execute(text("ALTER TABLE events ADD COLUMN updated_by INTEGER REFERENCES users(id)"))
        except Exception as e:
            print(f"    ⚠ updated_by column may already exist: {e}")
        
        try:
            conn.execute(text("ALTER TABLE events ADD COLUMN report_count INTEGER DEFAULT 0"))
        except Exception as e:
            print(f"    ⚠ report_count column may already exist: {e}")
        
        try:
            conn.execute(text("ALTER TABLE events ADD COLUMN is_hidden INTEGER DEFAULT 0"))
        except Exception as e:
            print(f"    ⚠ is_hidden column may already exist: {e}")
        
        # 2. users 테이블에 is_admin 필드 추가
        print("  ➤ Adding is_admin field to users table...")
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"))
        except Exception as e:
            print(f"    ⚠ is_admin column may already exist: {e}")
        
        # 3. event_histories 테이블 생성
        print("  ➤ Creating event_histories table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS event_histories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL REFERENCES events(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                action VARCHAR NOT NULL,
                snapshot TEXT NOT NULL,
                changes_summary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # 4. event_reports 테이블 생성
        print("  ➤ Creating event_reports table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS event_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL REFERENCES events(id),
                reporter_id INTEGER NOT NULL REFERENCES users(id),
                reason VARCHAR NOT NULL,
                description TEXT,
                status VARCHAR DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # 5. 인덱스 생성
        print("  ➤ Creating indexes...")
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_event_histories_event_id ON event_histories(event_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_event_histories_user_id ON event_histories(user_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_event_reports_event_id ON event_reports(event_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_event_reports_reporter_id ON event_reports(reporter_id)"))
        except Exception as e:
            print(f"    ⚠ Index creation warning: {e}")
    
    print("✅ Migration completed successfully!")

if __name__ == "__main__":
    try:
        run_migration()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
