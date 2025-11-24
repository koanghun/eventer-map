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

## 2025-11-23

### ✅ 개발 환경 설정 및 기능 테스트

**작업 내용**:
- 백엔드 및 프론트엔드 환경 변수 설정 (.env)
- Python 가상환경 생성 및 의존성 설치
- Node.js 의존성 설치 및 프론트엔드 서버 실행
- 기본 기능 테스트 (서버 실행 확인)

**이슈 및 해결**:

#### 1. 백엔드 (Python 3.13 호환성)
- **문제**: `pydantic==2.5.0` 등 고정된 버전이 Python 3.13용 wheel을 제공하지 않아 빌드 실패
- **해결**: `requirements.txt`에서 버전 고정(`==`)을 제거하여 최신 호환 버전 설치

#### 2. 프론트엔드 (React Scripts vs TypeScript)
- **문제**: `react-scripts@5.0.1`과 `typescript@5.x` 간의 Peer Dependency 충돌
- **해결**: `npm install --legacy-peer-deps` 옵션 사용

#### 3. 프론트엔드 런타임 에러
- **문제**: `ajv` 모듈 누락 및 Google Maps API Key 미설정
- **해결**: `npm install ajv`로 모듈 추가, `.env`에 API Key 설정

**다음 단계**:
- Docker Compose 통합 테스트
- Synology NAS 배포 준비

## 2025-11-24

### ✅ 데이터 모델 확장 및 이벤트 폼 기능 고도화

**작업 내용**:

#### 1. 백엔드: 장소(Place) 및 출연자(Performer) 모델 추가
- `models.py`: `Place`와 `Performer` SQLAlchemy 모델을 추가하고 `Event` 모델과 다대다(N:N) 관계를 설정했습니다.
- `schemas.py`: `Place`와 `Performer`에 대한 Pydantic 스키마를 정의하고, `EventResponse`가 관련 데이터를 포함하도록 수정했습니다.
- `routes/`:
  - `events.py`: 이벤트 생성 및 수정 시, 출연자와 장소 이름을 받아와 기존 데이터를 재사용하거나 새로 생성하여 연결하는 로직을 구현했습니다.
  - `places.py`, `performers.py`: 장소와 출연자 정보를 조회, 생성, 검색하는 API 엔드포인트를 추가했습니다.

#### 2. 프론트엔드: "스마트" 이벤트 폼 구현
- `services/api.ts`: 백엔드에 추가된 `Place` 및 `Performer` API와 통신하는 클라이언트 함수를 구현했습니다.
- `components/EventForm.tsx`:
  - **장소 검색 기능**: 장소명을 입력하면 먼저 백엔드 DB에서 검색하고, 없으면 Google Geocoding API로 조회 후 그 결과를 다시 DB에 캐싱하는 기능을 구현했습니다.
  - **출연자 선택 UI 개선**: 출연자 입력 필드를 단순 자동완성(`<datalist>`)에서 다중 선택(Multi-select)이 가능한 전용 컴포넌트(`MultiSelect.tsx`)로 교체하여 UX를 대폭 개선했습니다. 이제 사용자는 기존 출연자를 목록에서 선택하거나, 새 출연자를 태그 형식으로 편리하게 추가/제거할 수 있습니다.
  - **임시 저장 기능**: 새 이벤트를 작성하는 도중 페이지를 벗어나도 내용이 사라지지 않도록 폼 데이터를 `localStorage`에 자동으로 임시 저장하고, 제출 시 삭제하는 기능을 추가했습니다.
  - **UI 개선**: 장소 검색 버튼을 추가하고, 좌표(위도/경도) 필드는 사용자가 직접 입력하지 않도록 숨김 처리했습니다.

#### 3. 프론트엔드: 지도 및 앱 안정성 개선
- `App.tsx`: Google Maps API 스크립트 로딩을 `LoadScript` 컴포넌트를 사용하여 앱의 최상단에서 한 번만 실행하도록 구조를 변경했습니다.
- `components/EventMap.tsx`:
  - 기본 지도 중심을 서울에서 도쿄로 변경했습니다.
  - 지도 마커의 아이콘을 커스텀 SVG로 변경하여 시각적 완성도를 높였습니다.
  - 정보 창(InfoWindow)을 닫는 핸들러를 추가했습니다.

**이슈 및 해결**:
- 복잡해진 폼 상태 관리 및 비동기 데이터(장소, 출연자) 로딩으로 인한 복잡성을 `useEffect`와 `useState`를 조합하여 해결했습니다.
- 장소 검색 시, DB 조회와 Google API 조회를 순차적으로 실행하는 로직을 `async/await`과 `try/catch`를 사용하여 구현했습니다.
- **프론트엔드 빌드 에러**: 출연자 선택 UI 교체 과정에서 중복된 `export` 구문으로 인해 빌드 에러가 발생했으나, 해당 구문을 제거하여 해결했습니다.

**다음 단계**:
- 전체 기능에 대한 Docker Compose 통합 테스트
- 데이터 모델 변경에 따른 프론트엔드 `EventList` 및 `EventMap` 컴포넌트의 정보 표시 방식 업데이트
- 배포 환경에서의 최종 테스트