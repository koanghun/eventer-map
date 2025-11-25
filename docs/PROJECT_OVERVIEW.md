# Event Map 프로젝트 개요

> 📌 **프로젝트 시작**: 2025-11-21  
> 🎯 **목적**: 이벤트 정보를 지도에 시각화하는 웹 애플리케이션  
> 🏠 **배포**: Synology NAS + Docker  

---

## 🤖 AI 어시스턴트를 위한 빠른 시작 가이드

### 프로젝트 컨텍스트 파악하기

새로운 세션을 시작할 때 다음 순서로 문서를 읽어 프로젝트 상황을 파악하세요:

1. **이 문서 (PROJECT_OVERVIEW.md)** - 프로젝트의 전체 구조와 핵심 기능 이해
2. **[최신 개발 일지](./logs/2025/11-November.md)** - 가장 최근 작업 내용 파악 (맨 아래부터 역순으로 읽기)
3. **[현재 상태](./CURRENT_STATUS.md)** - 진행 중인 작업과 다음 우선순위 확인

#### 빠른 프롬프트

```
이 프로젝트는 Event Map으로, 이벤트 정보를 지도에 표시하는 웹 애플리케이션입니다.
- 백엔드: FastAPI + SQLAlchemy + SQLite
- 프론트엔드: React 18 + TypeScript + Google Maps API
- 개발 환경: WSL, 배포: Synology NAS + Docker

최근 작업:
[logs/2025/11-November.md의 가장 최근 날짜 섹션 내용]

현재 상태:
[CURRENT_STATUS.md의 "다음 단계" 우선순위 1 내용]

이제 [사용자 요청]을 처리하겠습니다.
```

---

## � 핵심 비즈니스 로직

### 주요 사용 시나리오

1. **이벤트 등록**: 사용자가 이벤트 정보 입력 → 장소 검색으로 자동 좌표 획득 → DB 저장
2. **날짜별 조회**: 날짜 선택 → 해당 날짜의 이벤트만 필터링 → 지도에 마커 표시
3. **상세 정보 확인**: 마커 클릭 → InfoWindow로 상세 정보 표시 → 장소/주소 클릭 시 Google Maps 연동

### 데이터 모델 관계

```
Event (이벤트)
├── 기본 정보: title, description, event_date, related_link
├── 시간 정보: door_time, start_time, end_time (개장/개연/종연)
├── 위치 정보: location, address, latitude, longitude
└── 관계형 데이터
    ├── Place (장소) - N:1 참조 (캐싱용)
    └── Performer (출연자) - N:N 다대다

Place (장소 캐시)
├── name, address, latitude, longitude
└── Geocoding API 결과를 DB에 저장하여 재사용

Performer (출연자)
├── name
└── 여러 이벤트에 재사용 가능
```

---

## 🏗️ 기술 스택 요약

### 백엔드
```
FastAPI (Python 3.11)
├── Uvicorn (ASGI 서버)
├── SQLAlchemy (ORM)
├── Pydantic (데이터 검증)
└── SQLite (DB, PostgreSQL 전환 가능)
```

### 프론트엔드
```
React 18 + TypeScript
├── Google Maps JavaScript API
├── Axios (HTTP 클라이언트)
├── date-fns (날짜 처리)
└── Custom Components
    ├── EventMap (지도)
    ├── EventForm (등록/수정 폼)
    ├── EventList (이벤트 목록)
    ├── DatePicker (날짜 선택)
    └── MultiSelect (출연자 선택)
```

### 인프라
```
Docker Compose
├── Backend Container (Python 3.11-slim)
├── Frontend Container (Nginx-alpine)
└── Volumes (데이터 영속성)

배포: Synology NAS
개발: WSL 환경
```

---

## 💡 핵심 기능 상세

### 1. 이벤트 관리 (CRUD)
- **등록**: 모든 필드 입력, 장소 자동 검색, 출연자 다중 선택, 임시 저장
- **조회**: 날짜별 필터링, 전체 목록
- **수정**: 기존 데이터 로드하여 수정
- **삭제**: 확인 후 삭제

### 2. 장소 검색 & Geocoding
- **워크플로우**:
  1. 사용자가 장소명 입력
  2. 백엔드 DB에서 먼저 검색 (캐시 히트)
  3. 없으면 Google Geocoding API 호출
  4. 결과를 DB에 저장 (캐싱)
  5. 좌표를 폼에 자동 입력
- **최적화**: API 호출 최소화로 비용 절감

### 3. 지도 시각화
- **마커**: 커스텀 SVG 아이콘, 이벤트 위치 표시
- **InfoWindow**: 표 형식으로 정보 표시
  - 장소/주소 클릭 → Google Maps 새 탭 열림
  - 개장/개연/종연 시간 구분 표시
  - 출연자, 설명, 관련 링크 표시
- **자동 중심**: 이벤트들의 평균 위치로 지도 중심 조정

### 4. 출연자 관리
- **MultiSelect UI**: 태그 형식의 다중 선택
- **자동완성**: 기존 출연자 목록에서 선택
- **새 출연자**: 직접 입력하여 추가
- **재사용**: 같은 출연자를 여러 이벤트에 연결

---

## 🎨 UI/UX 디자인 원칙

### 디자인 시스템
- **컬러**: 보라색 그라데이션 (`#667eea` → `#764ba2`)
- **스타일**: Glassmorphism, 부드러운 애니메이션
- **타이포그래피**: 시스템 폰트 스택
- **반응형**: 모바일/태블릿/데스크톱 지원

### 주요 컴포넌트 스타일
- **EventForm**: 모달 오버레이, 그룹화된 입력 필드
- **InfoWindow**: 표 형식, 그라데이션 헤더, 버튼 스타일 링크
- **EventList**: 카드 형식, 호버 효과
- **DatePicker**: 직관적인 날짜 선택

---

## ⚡ 최적화 전략

### Google Maps API 비용 최소화
1. **Geocoding 캐싱**: 장소 검색 결과를 DB에 저장하여 재사용
2. **지도 인스턴스 재사용**: `LoadScript`를 앱 최상단에서 한 번만 로드
3. **정적 마커**: 동적 업데이트 최소화
4. **API 키 제한**: 도메인/IP 화이트리스트 설정

### 프론트엔드 성능
- **코드 스플리팅**: React lazy loading (필요시 확장)
- **메모이제이션**: 불필요한 리렌더링 방지
- **임시 저장**: LocalStorage 활용

---

## 📁 프로젝트 구조

```
eventer-map/
├── backend/                 # FastAPI 백엔드
│   ├── main.py             # 앱 진입점
│   ├── database.py         # DB 연결
│   ├── models.py           # SQLAlchemy 모델
│   ├── schemas.py          # Pydantic 스키마
│   ├── routes/             # API 엔드포인트
│   │   ├── events.py       # 이벤트 CRUD
│   │   ├── places.py       # 장소 API
│   │   └── performers.py   # 출연자 API
│   ├── data/               # SQLite DB 저장
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/               # React 프론트엔드
│   ├── src/
│   │   ├── App.tsx         # 메인 앱
│   │   ├── components/     # 컴포넌트
│   │   │   ├── EventMap.tsx
│   │   │   ├── EventForm.tsx
│   │   │   ├── EventList.tsx
│   │   │   ├── DatePicker.tsx
│   │   │   └── MultiSelect.tsx
│   │   ├── services/       # API 클라이언트
│   │   │   └── api.ts
│   │   └── types/          # TypeScript 타입
│   │       └── event.ts
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
│
├── docs/                   # 프로젝트 문서
│   ├── PROJECT_OVERVIEW.md # 이 문서
│   ├── CURRENT_STATUS.md   # 현재 상태
│   ├── logs/               # 개발 일지
│   │   └── 2025/
│   │       └── 11-November.md
│   └── decisions/          # 기술 결정
│       ├── architecture.md
│       ├── database.md
│       ├── frontend.md
│       ├── infrastructure.md
│       └── optimization.md
│
├── docker-compose.yml      # Docker Compose 설정
├── .gitignore
└── README.md
```

---

## � 주요 API 엔드포인트

### Events
- `GET /events/` - 모든 이벤트 조회
- `GET /events/{id}` - 특정 이벤트 조회
- `GET /events/by-date/{date}` - 날짜별 이벤트 조회
- `POST /events/` - 새 이벤트 생성
- `PUT /events/{id}` - 이벤트 수정
- `DELETE /events/{id}` - 이벤트 삭제

### Places
- `GET /places/` - 모든 장소 조회
- `GET /places/search/{name}` - 장소 검색 (캐시 조회)
- `POST /places/` - 새 장소 추가

### Performers
- `GET /performers/` - 모든 출연자 조회
- `POST /performers/` - 새 출연자 추가

---

## 🔗 빠른 링크

### 필수 문서
- [현재 상태 및 다음 계획](./CURRENT_STATUS.md)
- [최신 개발 일지](./logs/2025/11-November.md)
- [메인 README](../README.md)

### 기술 결정 문서
- [아키텍처 결정](./decisions/architecture.md)
- [데이터베이스 설계](./decisions/database.md)
- [프론트엔드 구조](./decisions/frontend.md)
- [인프라 및 배포](./decisions/infrastructure.md)
- [최적화 전략](./decisions/optimization.md)

---

## � 빠른 실행

### 로컬 개발 (WSL)
```bash
# 백엔드
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드 (새 터미널)
cd frontend
npm install
npm start
```

### Docker Compose
```bash
docker-compose up -d
```

### 접속
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8000
- API 문서 (Swagger): http://localhost:8000/docs

---

## 📝 중요 참고사항

### 환경 변수
- **백엔드**: `DATABASE_URL`, `CORS_ORIGINS`
- **프론트엔드**: `REACT_APP_API_URL`, `REACT_APP_GOOGLE_MAPS_API_KEY`

### API 키
- Google Maps JavaScript API
- Geocoding API
- API 키에 도메인/IP 제한 설정 필수

### 데이터베이스
- 현재: SQLite (`backend/data/eventer.db`)
- 마이그레이션: `backend/migrate_time_fields.py` (시간 필드 분리용)
- 향후: PostgreSQL 전환 가능

---

**📊 프로젝트 현황**: 이 개요서를 읽은 후 [CURRENT_STATUS.md](./CURRENT_STATUS.md)에서 최신 진행 상황을 확인하세요.
