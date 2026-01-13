# Alembic 마이그레이션 가이드

> [!IMPORTANT]
> 이 프로젝트는 **Alembic**을 사용하여 데이터베이스 마이그레이션을 관리합니다.  
> 기존 수동 마이그레이션 스크립트(`backend/migrations_old/`)는 더 이상 사용하지 않습니다.

---

## 📋 목차

1. [기본 개념](#-기본-개념)
2. [마이그레이션 생성](#-마이그레이션-생성)
3. [마이그레이션 실행](#-마이그레이션-실행)
4. [마이그레이션 관리](#-마이그레이션-관리)
5. [롤백](#-롤백)
6. [주의사항](#-주의사항)
7. [실전 예제](#-실전-예제)

---

## 🎯 기본 개념

### Alembic이란?
Alembic은 SQLAlchemy를 위한 데이터베이스 마이그레이션 도구입니다. 스키마 변경을 버전 관리하고, 자동으로 마이그레이션 스크립트를 생성할 수 있습니다.

### 디렉토리 구조
```
backend/
├── alembic.ini              # Alembic 설정 파일
├── migrations/              # 마이그레이션 디렉토리
│   ├── env.py              # Alembic 환경 설정 (모델 메타데이터 연결)
│   ├── script.py.mako      # 마이그레이션 템플릿
│   └── versions/           # 마이그레이션 파일들이 저장되는 곳
└── db/
    ├── models.py           # SQLAlchemy 모델 정의
    └── database.py         # 데이터베이스 설정
```

---

## 🔧 마이그레이션 생성

### 1. 자동 생성 (Autogenerate) - **권장**

모델(`db/models.py`)을 수정한 후, Alembic이 자동으로 변경사항을 감지하여 마이그레이션 파일을 생성합니다.

#### 로컬 환경
```bash
cd backend

# 가상환경 활성화
source venv/bin/activate

# 마이그레이션 생성
alembic revision --autogenerate -m "설명 메시지"

# 예시
alembic revision --autogenerate -m "add user role column"
```

#### Docker 환경
```bash
# 백엔드 컨테이너에서 실행
docker-compose exec backend alembic revision --autogenerate -m "설명 메시지"

# 예시
docker-compose exec backend alembic revision --autogenerate -m "add user role column"
```

> [!TIP]
> **Autogenerate가 감지하는 것:**
> - 테이블 추가/제거
> - 컬럼 추가/제거
> - 컬럼 타입 변경
> - NOT NULL 제약조건 변경
> - 인덱스 추가/제거
>
> **Autogenerate가 감지하지 못하는 것:**
> - 테이블 이름 변경 (제거 + 추가로 인식)
> - 컬럼 이름 변경 (제거 + 추가로 인식)
> - 일부 제약조건 변경

### 2. 빈 마이그레이션 생성 (수동 작성)

복잡한 데이터 마이그레이션이나 autogenerate로 감지되지 않는 경우:

```bash
# 로컬
alembic revision -m "설명 메시지"

# Docker
docker-compose exec backend alembic revision -m "설명 메시지"
```

생성된 파일(`migrations/versions/xxxx_설명.py`)을 직접 편집합니다:

```python
def upgrade():
    # 마이그레이션 로직
    op.execute("UPDATE users SET role = 'user' WHERE role IS NULL")

def downgrade():
    # 롤백 로직
    op.execute("UPDATE users SET role = NULL WHERE role = 'user'")
```

---

## ▶️ 마이그레이션 실행

### 최신 버전으로 업그레이드

#### 로컬 환경
```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

#### Docker 환경
```bash
# 개발 환경
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head

# 프로덕션 환경 (Synology NAS)
docker-compose -f docker-compose.pro.yml exec backend alembic upgrade head
```

> [!NOTE]
> `entrypoint.sh`에서 컨테이너 시작 시 자동으로 `alembic upgrade head`가 실행됩니다.

### 특정 버전으로 업그레이드/다운그레이드

```bash
# 특정 revision으로 이동
alembic upgrade <revision_id>

# 예시
alembic upgrade ae1027a6acf

# Docker
docker-compose exec backend alembic upgrade ae1027a6acf
```

---

## 📊 마이그레이션 관리

### 현재 버전 확인

```bash
# 로컬
alembic current

# Docker
docker-compose exec backend alembic current
```

### 마이그레이션 히스토리 확인

```bash
# 전체 히스토리
alembic history

# 상세 히스토리
alembic history --verbose

# Docker
docker-compose exec backend alembic history
```

### 마이그레이션 파일 확인

```bash
# 마이그레이션 파일 목록
ls -l backend/migrations/versions/

# 특정 파일 내용 확인
cat backend/migrations/versions/xxxx_설명.py
```

---

## ⏮️ 롤백

### 1단계 롤백 (이전 버전으로)

```bash
# 로컬
alembic downgrade -1

# Docker
docker-compose exec backend alembic downgrade -1
```

### 특정 버전으로 롤백

```bash
# 로컬
alembic downgrade <revision_id>

# Docker
docker-compose exec backend alembic downgrade <revision_id>
```

### 전체 롤백 (초기 상태로)

```bash
# 로컬
alembic downgrade base

# Docker
docker-compose exec backend alembic downgrade base
```

> [!CAUTION]
> 롤백은 데이터 손실을 초래할 수 있습니다. 프로덕션 환경에서는 반드시 **백업 후 실행**하세요!

---

## ⚠️ 주의사항

### 1. 마이그레이션 파일 검토
Autogenerate로 생성된 파일은 **반드시 검토** 후 실행하세요.
- 의도하지 않은 변경사항이 포함될 수 있습니다
- 데이터 마이그레이션이 필요한 경우 수동 추가 필요

### 2. SQLite 제약사항
SQLite는 일부 `ALTER TABLE` 작업을 지원하지 않습니다:
- 컬럼 이름 변경 → 테이블 재생성 필요
- 컬럼 타입 변경 → 테이블 재생성 필요
- Foreign Key 제약조건 변경 → 테이블 재생성 필요

Alembic은 자동으로 테이블 재생성 방식을 사용하지만, 복잡한 경우 수동 작성이 필요할 수 있습니다.

### 3. 프로덕션 환경 적용
Synology NAS에서 마이그레이션 실행 전:

1. **데이터베이스 백업**
   ```bash
   # 호스트에서 실행
   cp /volume1/docker/eventer-map/backend/eventer.db \
      /volume1/docker/eventer-map/backend/eventer.db.backup.$(date +%Y%m%d_%H%M%S)
   ```

2. **마이그레이션 테스트**
   - 로컬 또는 개발 환경에서 먼저 테스트
   - 스테이징 데이터베이스로 검증

3. **적용**
   ```bash
   docker-compose -f docker-compose.pro.yml exec backend alembic upgrade head
   ```

### 4. Git 관리
- 마이그레이션 파일은 **반드시 Git에 커밋**
- `migrations/versions/` 디렉토리 전체를 추적
- 각 마이그레이션은 별도의 커밋으로 관리 권장

---

## 📚 실전 예제

### 예제 1: 새로운 컬럼 추가

1. **모델 수정** (`db/models.py`):
   ```python
   class User(Base):
       __tablename__ = "users"
       
       # ... 기존 컬럼들 ...
       role: Mapped[str] = mapped_column(String, default="user")  # 새로 추가
   ```

2. **마이그레이션 생성**:
   ```bash
   alembic revision --autogenerate -m "add user role column"
   ```

3. **생성된 파일 확인** (`migrations/versions/xxxx_add_user_role_column.py`):
   ```python
   def upgrade():
       op.add_column('users', sa.Column('role', sa.String(), nullable=True))
       # 기존 사용자들에게 기본값 설정
       op.execute("UPDATE users SET role = 'user' WHERE role IS NULL")
   ```

4. **마이그레이션 실행**:
   ```bash
   alembic upgrade head
   ```

### 예제 2: 테이블 추가

1. **모델 추가** (`db/models.py`):
   ```python
   class Category(Base):
       __tablename__ = "categories"
       
       id: Mapped[int] = mapped_column(primary_key=True)
       name: Mapped[str] = mapped_column(String, unique=True)
   ```

2. **마이그레이션 생성 및 실행**:
   ```bash
   alembic revision --autogenerate -m "add category table"
   alembic upgrade head
   ```

---

## 🔗 참고 자료

- [Alembic 공식 문서](https://alembic.sqlalchemy.org/)
- [SQLAlchemy 2.0 문서](https://docs.sqlalchemy.org/en/20/)
- [SQLite ALTER TABLE 제약사항](https://www.sqlite.org/lang_altertable.html)

---

## 🆘 문제 해결

### "Target database is not up to date" 오류
```bash
# 현재 버전 확인
alembic current

# stamp로 현재 상태 동기화
alembic stamp head
```

### 마이그레이션 충돌
```bash
# 히스토리 확인
alembic history

# 충돌하는 마이그레이션 파일 수동 병합 또는 삭제
```

### 데이터베이스와 모델 불일치
```bash
# 강제로 현재 스키마를 최신으로 인식
alembic stamp head

# 또는 데이터베이스 재생성 (개발 환경만!)
rm data/eventer.db
alembic upgrade head
```
