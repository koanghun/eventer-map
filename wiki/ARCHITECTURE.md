# 🏗️ Eventer Map 시스템 아키텍처 (System Architecture)

[⬅️ 홈으로 돌아가기](./Home.md) | [관련 문서: 기술 스택](./TECH_STACK.md)

이 문서는 Eventer Map의 **API-First 풀스택 아키텍처**, 백엔드 4계층 구조, 그리고 프론트엔드 상태·폼·지도 연동 설계를 설명합니다.

---

## 1. 🌐 전체 시스템 및 코드 생성 흐름 (Single Source of Truth)

본 프로젝트는 **OpenAPI 명세서(`backend/api/openapi.yaml`)**와 **SQL 정의(`backend/db/migration/`, `backend/db/query/`)**를 단일 진실 공급원으로 삼아 백엔드와 프론트엔드 코드를 자동 생성합니다.

```mermaid
flowchart LR
    subgraph DB_Layer["데이터베이스 계층"]
        SQLFiles[("SQL 정의<br/>(db/migration & db/query)")]
        SQLC{{"sqlc"}}
        DB[(PostgreSQL / Neon)]
    end

    subgraph Backend_Layer["백엔드 (Go net/http 4계층)"]
        Handler["Handler 계층<br/>(internal/handler)"]
        Service["Service 계층<br/>(internal/service)"]
        Repo["Repository 계층<br/>(internal/repository)"]
    end

    GoCodegen{{"oapi-codegen"}}
    OpenAPI[("OpenAPI 3.0 명세서<br/>(backend/api/openapi.yaml)")]
    Orval{{"Orval"}}

    subgraph Frontend_Layer["프론트엔드 (React + TypeScript)"]
        TSQuery["TanStack Query v5<br/>(src/api/generated)"]
        Zustand["Zustand<br/>(src/store)"]
        UI["사이드바 폼 & Google Map<br/>(EventFormPane / ArtistFormPane / VenueFormPane)"]
    end

    SQLFiles -->|"스키마/쿼리 파싱"| SQLC
    SQLC -->|"타입 안전 Go 코드 생성"| Repo
    Handler --> Service --> Repo
    Repo <-->|"Prepared SQL 실행"| DB

    OpenAPI -->|"명세 로드"| GoCodegen
    GoCodegen -->|"ServerInterface & 모델 생성"| Handler

    OpenAPI -->|"명세 로드"| Orval
    Orval -->|"TS 모델 & Query Hooks 생성"| TSQuery

    UI <--> TSQuery
    UI <--> Zustand
    TSQuery -.->|"HTTP (customInstance)"| Handler
```

---

## 2. 📂 백엔드 4단계 계층 구조 (`backend/`)

모든 의존성은 **Handler ➔ Service ➔ Repository** 단방향으로만 흐릅니다.

### 1) `cmd/server/` (진입점 & 의존성 주입)
- 환경변수 로드, PostgreSQL 커넥션 풀 초기화, `Repository ➔ Service ➔ Handler` 조립 및 로컬(`net/http`)/AWS Lambda 프록시 실행을 담당합니다.

### 2) `internal/middleware/` (공통 처리 계층)
- 표준 `http.Handler` 래핑 패턴으로 구현되어 있습니다.
  - `logger.go`: 요청 메서드, 경로, 소요 시간 로깅
  - `auth.go`: `Authorization: Bearer <token>` 검증 및 `context.WithValue`를 통한 `UserIDKey` 주입
  - `cors.go`: 브라우저 CORS 헤더 및 Preflight(`OPTIONS`) 처리

### 3) `internal/handler/` (표현 계층)
- `oapi-codegen`이 생성한 `openapi.gen.go`의 `ServerInterface`를 도메인별 파일(`event_handler.go`, `artist_handler.go`, `venue_handler.go`, `auth_handler.go`, `user_handler.go` 등)에서 구현합니다.
- 요청 파라미터/바디 파싱 및 입력값 검증(필수값, 문자열 길이, 위경도 범위, 이미지 MIME/용량 등)만 수행하고 비즈니스 로직은 `Service`에 위임합니다.

### 4) `internal/service/` (비즈니스 계층)
- HTTP 객체(`http.Request` 등)에 의존하지 않는 순수 Go 도메인 로직을 수행합니다.
- 유저 권한(`ADMIN` 여부)에 따른 등록 상태 결정(`PENDING` vs `APPROVED`), 신용점수(`credit_score`) 합산 및 자동 승인, 트랜잭션 처리를 담당합니다.

### 5) `internal/repository/` (데이터 접근 계층)
- `sqlc`가 `db/migration/*.sql`과 `db/query/*.sql`을 컴파일 타임에 검증하여 자동 생성한 패키지입니다.

---

## 3. 🎨 프론트엔드 좌측 사이드바 & 지도 연동 아키텍처 (`frontend/`)

지도 화면(`MapPage.tsx`)은 **좌측 사이드바 패널(20%)**과 **우측 인터랙티브 지도(`EventMap.tsx`, 80%)**로 구성됩니다.

### 1) 좌측 사이드바 단일 컨테이너 전환 구조
좌측 사이드바는 별도의 모달 팝업을 띄우지 않고, 상황에 따라 패널 컴포넌트를 매끄럽게 전환합니다:
- **기본 목록 뷰**: 날짜 필터(`DatePicker`), 출연자 필터(`ArtistSearch`), 이벤트 목록(`EventList`)
- **이벤트 상세 뷰 (`EventDetailPane.tsx`)**: 지도 마커 또는 리스트에서 이벤트 선택 시 상세 정보 및 출연자(`공식 이름 (식별 설명)`) 표시
- **새 이벤트 등록 뷰 (`EventFormPane.tsx`)**:
  - 작성 중인 모든 폼 상태를 브라우저 `sessionStorage`(`eventer_map_event_form_draft`)에 실시간 보존합니다.
  - **`'회장'` 및 `'출연자'` 저부하 자동완성**:
    - `300ms` 디바운스 + IME 조합(`isComposing`) 가드 + TanStack Query 5분 캐시(`staleTime`)로 서버 부하를 최소화합니다.
    - 일치하는 항목이 없으면 자동완성 드롭다운 **최하단**에 `"{검색어}" 회장 추가` / `"{검색어}" 출연자 추가` 버튼을 노출합니다.
  - **신규 출연자 등록 서브 뷰 (`ArtistFormPane.tsx`)**:
    - 좌측 상단 `'뒤로가기'` 버튼, 공식 이름, 히라가나, 동명이인 구분용 식별 설명(`disambiguation`), 성별(`여성`/`남성`), 프로필 이미지(최대 5MB, JPG/PNG) 업로드를 지원하며, 등록 완료 시 이벤트 폼의 출연자 목록에 즉시 추가됩니다.
  - **신규 회장 등록 서브 뷰 (`VenueFormPane.tsx`)**:
    - 좌측 상단 `'뒤로가기'` 버튼, 장소 검색 자동 입력, 공식 이름, 주소, 위도/경도, 수용 인원, 관련 링크 입력을 지원합니다.
    - **다단계 장소 검색 & 지도 클릭 연동**:
      1. Google Maps `PlacesService.textSearch` / `Geocoder`를 1차로 시도하고, API 키 권한 미활성화 시 **OpenStreetMap Nominatim 공개 API**로 자동 폴백하여 장소명·주소·위도·경도를 자동 입력합니다.
      2. 우측 지도(`EventMap.tsx`)를 직접 클릭하면 마커가 표시되면서 클릭 지점의 위도/경도와 역지오코딩 주소가 폼에 실시간 반영됩니다.
      3. 등록 완료 시 이벤트 폼으로 복귀하며 해당 회장이 즉시 선택됩니다.
