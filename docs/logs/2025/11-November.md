# 2025년 11월 개발 일지

## 2025-11-21

### ✅ 프로젝트 초기 설정 및 구조 생성

**작업 내용**:
- 프로젝트 요구사항 정의 및 기술 스택 결정
- Implementation Plan 작성 및 사용자 승인
- 전체 프로젝트 구조 생성 (백엔드, 프론트엔드, Docker)
- 문서화 시스템 구축

**생성된 주요 파일**:

#### 백엔드 (FastAPI)
- `backend/main.py` - FastAPI 애플리케이션 진입점, CORS 설정
- `backend/database.py` - SQLAlchemy 데이터베이스 연결 및 세션 관리
- `backend/models.py` - Event 데이터 모델 (SQLAlchemy ORM)
- `backend/schemas.py` - Pydantic 요청/응답 스키마 (유효성 검증)
- `backend/routes/events.py` - 이벤트 CRUD API 엔드포인트
- `backend/requirements.txt` - Python 의존성 패키지
- `backend/Dockerfile` - 백엔드 Docker 이미지 설정
- `backend/.env.example` - 환경 변수 템플릿

#### 프론트엔드 (React + TypeScript)
- `frontend/src/App.tsx` - 메인 애플리케이션 컴포넌트
- `frontend/src/components/EventMap.tsx` - Google Maps 통합 컴포넌트
- `frontend/src/components/EventForm.tsx` - 이벤트 등록/수정 모달 폼
- `frontend/src/components/EventList.tsx` - 이벤트 목록 표시 컴포넌트
- `frontend/src/components/DatePicker.tsx` - 날짜 선택 컴포넌트
- `frontend/src/services/api.ts` - Axios 기반 API 클라이언트
- `frontend/src/types/event.ts` - TypeScript 타입 정의
- `frontend/package.json` - Node.js 의존성
- `frontend/Dockerfile` - Multi-stage 빌드 Docker 이미지
- `frontend/nginx.conf` - Nginx 설정 (SPA 라우팅, API 프록시)
- `frontend/.env.example` - 환경 변수 템플릿

#### 인프라 및 문서
- `docker-compose.yml` - Docker Compose 전체 스택 설정
- `.gitignore` - Git 무시 파일 설정
- `README.md` - 프로젝트 메인 문서

#### 문서화 (초기 구조)
- `docs/PROJECT_OVERVIEW.md` - 프로젝트 전체 개요
- `docs/CURRENT_STATUS.md` - 현재 상태 및 계획
- `docs/DEVELOPMENT_LOG.md` - 개발 일지 (단일 파일, 이후 재구성됨)
- `docs/TECH_DECISIONS.md` - 기술 결정 Q&A (단일 파일, 이후 재구성됨)
- `docs/README.md` - 문서 가이드

**주요 기술 결정**:
- 데이터베이스: SQLite로 시작 (PostgreSQL 전환 가능)
- OS 이미지: Python 3.11-slim, Node 18-alpine, Nginx-alpine
- Google Maps API 최적화: Geocoding 캐싱, 지도 인스턴스 재사용, 정적 마커

**이슈 및 해결**:
- 없음 (초기 설정으로 이슈 없이 진행)

**다음 단계**:
- Google Maps API 키 발급
- 로컬 개발 환경 설정 (WSL)
- 기본 기능 테스트

---

### ✅ 문서 구조 재구성

**작업 내용**:
- 개발 일지를 연도/월별로 분리
- 기술 결정을 주제별로 분류
- 문서 관리 개선 및 확장성 확보

**변경 파일**:
- `.gitignore` - docs/logs 디렉토리 포함 설정
- `docs/logs/README.md` - 개발 일지 인덱스 생성
- `docs/logs/2025/11-November.md` - 2025년 11월 일지 (현재 문서)
- `docs/decisions/README.md` - 기술 결정 인덱스 생성
- `docs/decisions/architecture.md` - 아키텍처 결정사항
- `docs/decisions/database.md` - 데이터베이스 관련 결정
- `docs/decisions/frontend.md` - 프론트엔드 관련 결정
- `docs/decisions/infrastructure.md` - 인프라/배포 관련 결정
- `docs/decisions/optimization.md` - 최적화 전략
- `docs/README.md` - 새 문서 구조 반영

**이유**:
- 개발 일지와 기술 결정이 길어질 것을 대비
- 연도/월별 구조로 시간 기반 탐색 용이
- 주제별 분류로 관련 기술 결정 한눈에 파악

**다음 단계**:
- 기존 DEVELOPMENT_LOG.md, TECH_DECISIONS.md 삭제
- CURRENT_STATUS.md 업데이트하여 새 문서 구조 반영
