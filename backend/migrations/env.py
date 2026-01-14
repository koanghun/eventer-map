from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Alembic Config 객체로, .ini 파일의 값에 접근할 수 있습니다.
config = context.config

# DATABASE_URL 환경 변수로 sqlalchemy.url을 오버라이드
# alembic.ini의 플레이스홀더 "driver://"가 사용되는 것을 방지합니다.
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

# Python 로깅을 위한 설정 파일 해석
# 기본적으로 로거를 설정합니다.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 모델의 MetaData 객체를 여기에 추가합니다.
# 'autogenerate' 지원을 위함
# database 모듈에서 Base를 import (db/__init__.py를 통해 모든 모델 import)
import sys
from pathlib import Path

# /app이 루트 디렉토리인지 확인하고 절대 경로로 설정
sys.path.insert(0, '/app')

# Base.metadata에 등록되도록 모델들을 import
from db.database import Base
from db import models  # 모든 모델이 로드되도록 함

target_metadata = Base.metadata

# env.py에서 필요한 다른 설정 값들을 가져올 수 있습니다:
# my_important_option = config.get_main_option("my_important_option")
# ... 등등


def run_migrations_offline() -> None:
    """'offline' 모드로 마이그레이션 실행.

    URL만으로 컨텍스트를 구성하며 Engine은 사용하지 않습니다.
    (Engine도 사용 가능합니다)
    Engine 생성을 건너뛰므로 DBAPI조차 필요하지 않습니다.

    여기서 context.execute() 호출은 주어진 문자열을
    스크립트 출력으로 내보냅니다.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """'online' 모드로 마이그레이션 실행.

    이 시나리오에서는 Engine을 생성하고
    컨텍스트와 연결을 연결해야 합니다.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
