# 로컬 데이터베이스 설정 가이드

원격 데이터베이스 접속이 불가능할 경우, 로컬에서 테스트할 수 있는 두 가지 방법을 안내합니다.

---

## 💡 옵션 1: Docker PostgreSQL 사용 (추천)

원격 서버와 동일한 PostgreSQL 환경을 로컬에 구동하여 테스트하는 방식입니다.

### 1. 전제 조건
- Docker 및 Docker Compose가 설치되어 있어야 합니다.

### 2. 실행 방법

프로젝트 루트 디렉토리에서 아래 명령어를 실행하여 PostgreSQL 컨테이너를 구동합니다.

```bash
docker-compose -f docker-compose.db.yml up -d
```

### 3. 환경 변수 수정 (`.env`)

`backend/.env` 파일의 `DATABASE_URL`을 로컬 DB 주소로 변경합니다.

```bash
# 변경 전 (원격 DB)
# DATABASE_URL=postgresql://eventer:eventer_pass@ludwig1824.synology.me:20048/eventer_db

# 변경 후 (로컬 Docker DB)
DATABASE_URL=postgresql://eventer:eventer_pass@localhost:5432/eventer_db
```

### 4. 데이터베이스 초기화 및 마이그레이션 실행

> 💡 **자동 생성 안내**: `backend/main.py`에 `models.Base.metadata.create_all(bind=engine)` 코드가 포함되어 있어, **백엔드 서버를 시작하면 자동으로 테이블이 생성**됩니다.
> 따라서 바로 서버를 구동해도 테스트는 가능하지만, **Alembic 마이그레이션 이력을 동기화**하여 추후 마이그레이션 오류를 완벽히 방지하기 위해 아래 과정을 거치는 것을 **강력히 권장**합니다.

새로 만든 데이터베이스는 비어있으므로, 초기 테이블을 생성하고 마이그레이션 이력을 기록해야 합니다.

`backend` 폴더에서 아래 명령어를 실행합니다.

```bash
cd backend

# 1. 초기 테이블 생성
# (models.Base.metadata.create_all()을 실행하여 전체 스키마를 생성합니다.)
./venv/bin/python -c 'from main import engine; from db.models import Base; Base.metadata.create_all(bind=engine)'

# 2. Alembic 마이그레이션 스탬프 찍기
# (이미 최신 스키마가 생성되었으므로, 마이그레이션을 실행하는 대신 현재 상태를 '최신(head)'으로 기록합니다.)
./venv/bin/alembic stamp head
```

---

## 💡 옵션 2: SQLite 사용 (가장 빠르고 간편함)

별도의 서버 설치 없이 파일 기반으로 작동하므로 가장 빠르고 간편하게 테스트할 수 있습니다.
(`backend/db/database.py`에서 이미 기본값으로 지원하며, 모델도 SQLite 호환성을 고려해 설계되었습니다.)

### 1. 환경 변수 수정 (`.env`)

`backend/.env` 파일의 `DATABASE_URL`을 SQLite 주소로 변경합니다.

```bash
# 변경 후 (SQLite)
DATABASE_URL=sqlite:///./data/eventer.db
```

### 2. 데이터베이스 초기화 및 마이그레이션 실행

테이블을 생성하기 위해 `backend` 폴더에서 동일하게 초기화 명령을 실행합니다.

```bash
cd backend

# 1. 초기 테이블 생성
./venv/bin/python -c 'from main import engine; from db.models import Base; Base.metadata.create_all(bind=engine)'

# 2. Alembic 마이그레이션 스탬프 찍기
./venv/bin/alembic stamp head
```

---

## 🛠️ 트러블슈팅

### 1. 포트 충돌
Docker 구동 시 포트 충돌이 발생하면 `docker-compose.db.yml` 파일에서 `ports`의 **왼쪽** 포트(호스트 포트)를 변경하세요.
예: `- "5433:5432"` (이 경우 `.env`의 포트도 `5433`으로 변경해야 합니다.)

### 2. SQLite 데이터 확인
SQLite 사용 시 생성된 `.db` 파일은 `backend/data/eventer.db`에 위치합니다.
