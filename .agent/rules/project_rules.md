---
name: eventer-map-guidelines
description: Eventer Map 프로젝트의 백엔드(Go, sqlc), 프론트엔드(Orval) 아키텍처 및 코딩 컨벤션 룰입니다.
trigger: always_on
---

# Eventer Map Project Guidelines

이 문서는 Eventer Map 프로젝트를 위한 AI 에이전트 커스텀 룰입니다. 에이전트는 코드를 작성하거나 수정할 때 항상 이 규칙을 준수해야 합니다.

## 1. 🏗️ 아키텍처 (Backend Architecture)
본 백엔드는 4단계 계층형 아키텍처(Layered Architecture)를 가지며 단방향(Handler ➔ Service ➔ Repository)으로만 의존합니다.
- `cmd/server/`: 애플리케이션 시작점 및 DI(의존성 주입) 수행.
- `internal/middleware/`: 로깅, 인증 등 공통 처리. 미들웨어도 `http.Handler` 구현체입니다.
- `internal/handler/`: HTTP 라우팅 및 파라미터 검증 (비즈니스 로직 금지). `oapi-codegen` 활용.
- `internal/service/`: 도메인 비즈니스 로직. HTTP Request 객체를 전혀 모르는 순수 Go 타입 유지. 거의 모든 함수의 첫 번째 파라미터는 `ctx context.Context`여야 합니다.
- `internal/repository/`: DB 연동. 순수 SQL을 작성하면 `sqlc`가 코드를 생성합니다.

## 2. 🛠️ 기술 스택 (Tech Stack)
### Backend
- **Go Standard Library (`net/http`)**: Echo, Gin 등 무거운 외부 프레임워크 절대 사용 금지.
- **OpenAPI 3.0 & oapi-codegen**: 스키마 퍼스트 API 개발. `api/openapi.yaml` 수정 후 코드를 자동 생성합니다.
- **Database**: PostgreSQL (NEON 서버리스 사용)
- **DB Tool (sqlc)**: ORM 사용 금지. 직접 작성한 순수 SQL문을 `db/query/*.sql` 하위에 작성하고, `sqlc generate`를 실행하여 Type-safe한 Go 코드를 자동 생성하여 사용.
- **Migration**: DB 스키마 변경 시 `db/migration/` 에 `.sql` 파일을 생성 (`migrate` 도구 사용). 기존 마이그레이션 파일 수정 금지.

### Frontend
- **API Client (Orval)**: OpenAPI 명세를 기반으로 Axios 호출 및 React Query 훅(`useQuery`, `useMutation`)을 자동 생성하여 사용. API 변경 시 `npm run generate:api` 실행.
- 프론트엔드에서는 직접 Axios 인터페이스를 수동 코딩하지 않고 반드시 생성된 훅(예: `useGetEvents`, `usePostAuthSignup`)을 사용합니다.

## 3. 💾 데이터베이스 작성 룰 (Database & sqlc)
- **Cursor Pagination**: 무한 스크롤 및 고속 조회를 위해 쿼리에 `LIMIT + OFFSET`을 지양하고 **커서(Cursor) 방식(`WHERE id > @cursor_id`)**을 적용합니다.
- **Conditional Update**: 수정된 필드만 업데이트 할 때에는 `sqlc.narg()`와 `COALESCE()`를 결합하여 사용합니다.
- **sqlc Annotation**: SQL 작성 시 반드시 쿼리 상단에 sqlc 매직 주석(예: `-- name: CreateUser :one`)을 작성합니다. (`:one`, `:many`, `:exec`, `:execrows`)
- **Foreign Key**: 유저 탈퇴 시 유지되어야 하는 핵심 엔티티의 참조는 `ON DELETE CASCADE` 대신 `ON DELETE SET NULL`을 사용합니다.
- 인덱스 최적화를 고려하여 작성합니다. (예: Like 자동완성은 `varchar_pattern_ops`, 위치 좌표는 Box 인덱스 등)

## 4. 🔐 인증 시스템 (Auth)
- 클라이언트 접근 통제는 **자체 JWT(Bearer Token)**를 사용합니다.
- Access Token은 JSON Body로 전달받고 클라이언트 메모리에 저장(CSRF 방어), Refresh Token은 HttpOnly Cookie로 저장(XSS 방어)합니다.
- `internal/middleware/` 에서 토큰 검증 후 Context(`context.WithValue`)에 유저 정보를 담아 핸들러/서비스로 넘기는 방식으로 구현합니다.

## 5. 💡 개발 워크플로우 명심사항
- **API 개발**: `openapi.yaml` 수정 ➔ `oapi-codegen` 및 프론트엔드 `Orval` 생성 ➔ `internal/handler` 및 `internal/service` 구현.
- **DB 수정**: `db/migration/` 에 새 마이그레이션 스크립트 작성 ➔ `make migrateup` ➔ `db/query/` 에 쿼리 작성 ➔ `sqlc generate` 실행 ➔ Service 로직에 반영.

이 규칙을 바탕으로 프로젝트 전체의 일관성(표준 라이브러리 활용, 스키마/쿼리 기반 자동생성, 타입 안정성)을 엄격하게 유지하십시오.
