# 🛠️ 기술 스택 명세서 (TECH STACK)

[⬅️ 홈으로 돌아가기](./Home.md) | [관련 문서: 시스템 아키텍처](./ARCHITECTURE.md)

이 문서는 Eventer Map 프로젝트의 풀스택(백엔드, 프론트엔드, 데이터베이스, 인프라) 기술 스택을 정의합니다.

---

## 1. 백엔드 (Backend - Go)
- **개발 언어:** **Go (Golang)**
- **웹 서버 / 라우터:** **Go 표준 라이브러리 (`net/http`)**
  - 외부 프레임워크(Echo, Gin, Fiber 등)를 사용하지 않고 표준 `http.ServeMux`와 미들웨어 체인을 사용하여 AWS Lambda 콜드 스타트를 최소화합니다.
- **API 코드 생성:** **`oapi-codegen` (v2)**
  - `backend/api/openapi.yaml`로부터 `internal/handler/openapi.gen.go`(`types`, `std-http`, `spec`)를 자동 생성합니다.
- **인프라 & 서버리스:** **AWS Lambda (`provided.al2023`, `arm64`) + Amazon API Gateway + Amazon S3 + CloudFront OAC (AWS SAM 단일 스택 관리)**
  - 상세 아키텍처 및 원클릭 배포/CI·CD 설정은 [AWS 서버리스 & 정적 배포 가이드](./AWS_DEPLOYMENT_GUIDE.md)를 참고하세요.

---

## 2. 데이터베이스 (Database - PostgreSQL)
- **DBMS:** **PostgreSQL (Synology NAS Docker PostgreSQL)**
  - 서버리스(AWS Lambda) 스케일 아웃 시 커넥션 고갈 방지를 위해 인스턴스당 제한된 커넥션 풀(`MaxOpenConns=2`, `MaxIdleConns=1`)을 적용합니다.
- **쿼리 컴파일러:** **`sqlc`**
  - ORM(GORM 등)을 사용하지 않고 `db/migration/*.sql`과 `db/query/*.sql`로부터 타입 안전 Go 코드(`internal/repository/`)를 생성합니다.
- **스키마 마이그레이션:** **`golang-migrate`**
  - `backend/db/migration/` 하위의 버전별 `.up.sql` / `.down.sql` 파일로 스키마 이력을 관리합니다.
- **인덱스 최적화:**
  - 지도 바운딩 박스 조회용 공간/좌표 인덱스(`latitude`, `longitude`)
  - 회장/출연자 저부하 전방 일치 자동완성용 `LOWER(official_name) varchar_pattern_ops` 및 `hiragana varchar_pattern_ops` B-Tree 인덱스

---

## 3. 프론트엔드 (Frontend - React + TypeScript)
- **코어 프레임워크:** **React 18 + TypeScript**
- **API 클라이언트 자동 생성:** **`Orval`**
  - `backend/api/openapi.yaml`을 파싱하여 `src/api/generated/model`에 TypeScript 모델을, `src/api/generated/<tag>/`에 **TanStack Query v5** 커스텀 훅을 `tags-split` 모드로 자동 생성합니다.
- **서버 상태 관리:** **TanStack Query (v5)**
  - API 응답 캐싱(`staleTime`, `gcTime`), 자동완성 검색 결과 캐싱, 쿼리 무효화(`invalidateQueries`)를 전담합니다.
- **클라이언트 전역 상태 관리:** **Zustand**
  - 선택된 이벤트(`selectedEvent`), 지도 뷰포트(`mapBounds`), 신규 회장 등록 시 지도 클릭 좌표(`venueDraftLocation`) 등 순수 클라이언트 상태만 `src/store/`에서 관리합니다.
- **지도 & 지오코딩:** **`@react-google-maps/api` + OpenStreetMap Nominatim 폴백**
  - Google Maps 기반 이벤트 마커/클러스터 렌더링 및 신규 회장 등록 시 Google Places/Geocoder + OpenStreetMap Nominatim 다단계 장소 검색 및 역지오코딩을 지원합니다.
- **UI & 스타일링:** **Tailwind CSS + Radix UI + Lucide Icons**
- **다국어 지원 (i18n):** **`i18next` / `react-i18next`** (`ko`, `ja`, `en`, `zh` 4개 국어 지원)

---

## 4. 인증 및 보안 (Authentication & Security)
- **방식:** 자체 JWT 이중 토큰 구조 (Access Token + Refresh Token)
- **지원 방식:** 자체 이메일/비밀번호 인증(6자리 이메일 코드 검증) 및 Google OAuth(`idToken`) 로그인/계정 연동
- **토큰 보관:**
  - **Access Token:** JSON 응답 바디로 전달받아 클라이언트 메모리(`src/lib/axios.ts`)에만 보관 (XSS/CSRF 방어)
  - **Refresh Token:** `HttpOnly`, `Secure`(배포 환경 자동 활성화) 쿠키에 저장 (`withCredentials: true`, 환경별 `SameSite`/`Domain` 분기 지원)

---
*문서 최종 업데이트: 2026-11-08*
