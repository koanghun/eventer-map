"""Add tracking and reporting fields

Revision ID: 20260114_tracking
Revises: 
Create Date: 2026-01-14 07:03:00

이 마이그레이션은 배포환경의 events/users 테이블에 누락된 컬럼을 추가합니다.
개발환경에서는 이미 수동 스크립트로 추가되었지만, 배포환경에는 반영되지 않았습니다.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260114_tracking'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """
    배포 환경의 기존 테이블에 누락된 컬럼 추가 및 새 테이블 생성
    개발환경과 배포환경 모두에서 안전하게 실행 가능하도록 컬럼 존재 여부 확인
    """
    
    # 헬퍼 함수: 컬럼 존재 여부 확인
    def column_exists(table_name, column_name):
        conn = op.get_bind()
        result = conn.execute(sa.text(f"PRAGMA table_info({table_name})"))
        columns = [row[1] for row in result]
        return column_name in columns
    
    # 1. events 테이블에 추적 필드 추가
    # SQLite는 ALTER TABLE 제약이 많아서 batch 모드 사용
    columns_to_add = []
    
    if not column_exists('events', 'created_by'):
        columns_to_add.append(('created_by', sa.Column('created_by', sa.Integer(), nullable=True)))
    if not column_exists('events', 'updated_by'):
        columns_to_add.append(('updated_by', sa.Column('updated_by', sa.Integer(), nullable=True)))
    if not column_exists('events', 'report_count'):
        columns_to_add.append(('report_count', sa.Column('report_count', sa.Integer(), server_default='0', nullable=False)))
    if not column_exists('events', 'is_hidden'):
        columns_to_add.append(('is_hidden', sa.Column('is_hidden', sa.Integer(), server_default='0', nullable=False)))
    
    # 컬럼이 하나라도 추가될 경우에만 batch 실행
    if columns_to_add:
        with op.batch_alter_table('events', schema=None) as batch_op:
            for col_name, col_def in columns_to_add:
                batch_op.add_column(col_def)
        print(f"✓ events 테이블에 {len(columns_to_add)}개 컬럼 추가됨")
    else:
        print("✓ events 테이블 컬럼이 이미 존재함 (스킵)")
    
    # 외래키 제약조건 추가 (이미 존재 여부는 SQLAlchemy가 자동으로 처리)
    # SQLite에서는 외래키가 이미 있으면 에러가 발생할 수 있으므로 try-except 사용
    try:
        with op.batch_alter_table('events', schema=None) as batch_op:
            if not column_exists('events', 'created_by') or True:  # 항상 시도
                batch_op.create_foreign_key('fk_events_created_by', 'users', ['created_by'], ['id'])
                batch_op.create_foreign_key('fk_events_updated_by', 'users', ['updated_by'], ['id'])
        print("✓ events 테이블 외래키 추가됨")
    except Exception as e:
        print(f"⚠ 외래키 추가 스킵 (이미 존재하거나 오류): {e}")
    
    # 2. users 테이블에 is_admin 필드 추가
    if not column_exists('users', 'is_admin'):
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('is_admin', sa.Integer(), server_default='0', nullable=False))
        print("✓ users 테이블에 is_admin 컬럼 추가됨")
    else:
        print("✓ users.is_admin 컬럼이 이미 존재함 (스킵)")
    
    # 3. event_histories 테이블 생성 (이미 있으면 CREATE TABLE IF NOT EXISTS로 무시됨)
    op.execute("""
        CREATE TABLE IF NOT EXISTS event_histories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action VARCHAR NOT NULL,
            snapshot TEXT NOT NULL,
            changes_summary TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    # 인덱스 생성 (이미 있으면 무시)
    op.execute("CREATE INDEX IF NOT EXISTS idx_event_histories_event_id ON event_histories(event_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_event_histories_user_id ON event_histories(user_id)")
    
    # 4. event_reports 테이블 생성
    op.execute("""
        CREATE TABLE IF NOT EXISTS event_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            reporter_id INTEGER NOT NULL,
            reason VARCHAR NOT NULL,
            description TEXT,
            status VARCHAR DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id),
            FOREIGN KEY (reporter_id) REFERENCES users(id)
        )
    """)
    
    # 인덱스 생성
    op.execute("CREATE INDEX IF NOT EXISTS idx_event_reports_event_id ON event_reports(event_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_event_reports_reporter_id ON event_reports(reporter_id)")


def downgrade():
    """
    마이그레이션 롤백 (개발 전용, 프로덕션에서는 사용 금지)
    """
    # event_reports 삭제
    op.execute("DROP INDEX IF EXISTS idx_event_reports_reporter_id")
    op.execute("DROP INDEX IF EXISTS idx_event_reports_event_id")
    op.execute("DROP TABLE IF EXISTS event_reports")
    
    # event_histories 삭제
    op.execute("DROP INDEX IF EXISTS idx_event_histories_user_id")
    op.execute("DROP INDEX IF EXISTS idx_event_histories_event_id")
    op.execute("DROP TABLE IF EXISTS event_histories")
    
    # users 테이블에서 is_admin 제거
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('is_admin')
    
    # events 테이블에서 추적 필드 제거
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_constraint('fk_events_updated_by', type_='foreignkey')
        batch_op.drop_constraint('fk_events_created_by', type_='foreignkey')
        batch_op.drop_column('is_hidden')
        batch_op.drop_column('report_count')
        batch_op.drop_column('updated_by')
        batch_op.drop_column('created_by')
