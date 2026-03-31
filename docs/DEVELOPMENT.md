# 개발 가이드 (Development Guide)

이 문서는 Eventer Map 프로젝트의 로컬 개발 환경 구축 및 관리 방법을 안내합니다.

## 📋 목차
1. [개발 환경 구축](#1-개발-환경-구축)
2. [환경 변수 설정](#2-환경-변수-설정)
3. [Google OAuth 설정](#3-google-oauth-설정)
4. [데이터베이스 관리 (Alembic)](#4-데이터베이스-관리-alembic)
5. [로컬 데이터베이스 설정 (SQLite/PostgreSQL)](#5-로컬-데이터베이스-설정)
6. [프론트엔드 디자인 시스템 (Tailwind/shadcn)](#6-프론트엔드-디자인-시스템)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 개발 환경 구축

Docker Compose를 사용하여 백엔드, 프론트엔드, 개발용 도구를 한꺼번에 실행할 수 있습니다.

### 사전 준비
- Docker 및 Docker Compose 설치
- VS Code (Remote SSH 확장 권장)

### 실행 방법
```bash
# 개발 환경 실행
docker-compose -f docker-compose.dev.yml up -d --build

# 로그 확인
docker-compose -f docker-compose.dev.yml logs -f
```

---

## 2. 환경 변수 설정

프로젝트 루트의 `.env` 파일을 복사하여 설정을 진행합니다.

### 주요 변수 목록
- `DATABASE_URL`: 데이터베이스 접속 정보
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth 인증 정보
- `JWT_SECRET_KEY`: 토큰 서명용 비밀키
- `REACT_APP_GOOGLE_MAPS_API_KEY`: Google Maps JavaScript API 키

상세 내용은 `.env.example` 파일을 참고하세요.

---

## 3. Google OAuth 설정

Google 로그인을 사용하기 위해 [Google Cloud Console](https://console.cloud.google.com/)에서 다음 설정을 수행해야 합니다.

1. **OAuth 동의 화면** 구성 (외부 타입)
2. **사용자 인증 정보**에서 "OAuth 2.0 클라이언트 ID" 생성 (웹 애플리케이션)
3. **승인된 리디렉션 URI** 추가:
   - 로컬 개발: `http://localhost:8000/api/auth/google/callback`
   - 운영 환경: `https://[도메인]/api/auth/google/callback`

---

## 4. 데이터베이스 관리 (Alembic)

SQLAlchemy 모델 변경 사항을 DB에 반영하기 위해 Alembic을 사용합니다.

### 마이그레이션 생성
```bash
# 백엔드 컨테이너 내부에서 실행
docker-compose -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "변경 내용 설명"
```

### 마이그레이션 적용
```bash
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head
```

---

## 5. 로컬 데이터베이스 설정

원격 DB 접속이 불가능할 경우 로컬에서 테스트하는 방법입니다.

### 옵션 1: Docker PostgreSQL (추천)
```bash
docker-compose -f docker-compose.db.yml up -d
```
`.env`의 `DATABASE_URL`을 `postgresql://eventer:eventer_pass@localhost:5432/eventer_db`로 수정합니다.

### 옵션 2: SQLite (가장 간편함)
`.env`의 `DATABASE_URL`을 `sqlite:///./data/eventer.db`로 수정합니다.

---

## 6. 프론트엔드 디자인 시스템

본 프로젝트는 **Tailwind CSS**와 **shadcn/ui**를 디자인 시스템으로 사용합니다.

- **스타일 정의**: `frontend/src/index.css` 및 `tailwind.config.js`
- **UI 컴포넌트**: `frontend/src/components/ui/` 폴더 내의 컴포넌트 활용 권장 (Button, Input, Popover 등)

---

## 7. 트러블슈팅

### redirect_uri_mismatch
- Google Cloud Console의 리디렉션 URI와 `.env`의 `GOOGLE_REDIRECT_URI`가 정확히 일치하는지 확인하세요.

### 401 Unauthorized
- `JWT_SECRET_KEY`가 설정되어 있는지 확인하고, 브라우저 쿠키/로컬 스토리지의 토큰을 확인하세요.

### 컨테이너 권한 문제
- `chown -R developer:developer /app` 등의 명령어가 `entrypoint.sh`에서 정상 실행되는지 확인하세요.
