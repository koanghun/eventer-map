from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# .env 파일에서 환경 변수를 불러옵니다.
load_dotenv()

# 환경 변수에서 데이터베이스 URL을 가져옵니다.
# 지정되지 않은 경우 SQLite 인메모리 데이터베이스를 기본값으로 사용합니다.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/eventer.db")

# SQLAlchemy 엔진을 생성합니다.
# 이 엔진은 데이터베이스와의 통신을 담당합니다.
# SQLite의 경우, FastAPI와 같은 웹 애플리케이션에서 일반적이듯이 여러 스레드가 동일한 연결에 접근할 수 있도록
# 'check_same_thread'를 False로 설정합니다.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# SessionLocal 클래스를 설정합니다.
# SessionLocal의 각 인스턴스는 데이터베이스 세션이 됩니다.
# 'autocommit=False'는 변경 사항이 자동으로 커밋되지 않음을 의미합니다.
# 'autoflush=False'는 모든 쿼리 후 데이터베이스로의 플러시를 방지합니다.
# 'bind=engine'은 이 세션을 데이터베이스 엔진에 연결합니다.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 선언적 모델을 위한 Base 클래스를 선언합니다.
# 이 Base 클래스는 모든 SQLAlchemy 모델이 스키마를 정의하기 위해 상속합니다.
Base = declarative_base()


# 데이터베이스 세션을 가져오기 위한 의존성.
# 이 함수는 데이터베이스 세션을 생성하고 사용 후 닫히도록 보장합니다.
# 이는 웹 애플리케이션에서 적절한 리소스 관리에 중요합니다.
def get_db():
    db = SessionLocal()  # 새 세션을 생성합니다.
    try:
        yield db  # 호출자에게 세션을 생성합니다.
    finally:
        db.close()  # 요청이 끝난 후 세션을 닫습니다.