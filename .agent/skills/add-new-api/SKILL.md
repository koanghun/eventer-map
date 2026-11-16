---
name: add-new-api
description: >-
  Use this skill when adding or modifying an API endpoint in Eventer Map.
  Covers updating backend/api/openapi.yaml, running oapi-codegen and Orval code generators,
  implementing the Go net/http Handler and Service layers, and binding TanStack Query hooks in the frontend.
---

# 🚀 새로운 API 추가 및 변경 워크플로우 (Add / Update API)

Eventer Map 프로젝트는 `backend/api/openapi.yaml`을 단일 진실 공급원(Single Source of Truth)으로 사용하는 API-First 아키텍처입니다. 새로운 API를 추가하거나 기존 스펙을 변경할 때 아래 절차를 순서대로 수행하세요.

---

## 📋 단계별 실행 가이드

### Step 1: OpenAPI 명세서(`backend/api/openapi.yaml`) 업데이트
1. `backend/api/openapi.yaml`에 엔드포인트의 `path`, HTTP `method`, `tags`, `operationId`, `parameters`/`requestBody`, `responses`를 정의합니다.
2. **필수 규칙**:
   - **`tags`**: Orval이 `tags-split` 모드로 폴더(`frontend/src/api/generated/<tag>/`)를 나누므로 반드시 표준 태그를 지정합니다.
     - 현재 태그: `Events` (`events/`), `Artists` (`artists/`), `Venues` (`venues/`), `Auth` (`auth/`), `User` (`user/`), `Threads` (`threads/`), `ModificationRequests` (`modification-requests/`), `System` (`system/`).
   - **`operationId`**: 백엔드 `ServerInterface` 메서드 이름과 프론트엔드 TanStack Query 훅 이름(`use<OperationId>`)으로 변환되므로 직관적인 `camelCase`로 작성합니다.
   - 공통 DTO/응답 모델은 `components.schemas`에 정의하여 재사용합니다.

---

### Step 2: 백엔드 & 프론트엔드 코드 자동 생성

루트에서 통합 명령어를 실행하거나 백엔드/프론트엔드별로 실행합니다 (`oapi-codegen`과 `sqlc` 바이너리는 `/home/parkkh/go/bin`에 설치되어 있으며 `backend/Makefile`의 `PATH`를 통해 자동 탐색됩니다).

```bash
# 루트에서 백엔드 + 프론트엔드 동시 생성 (권장)
make generate
```

개별 실행이 필요한 경우:
```bash
# 1) 백엔드 (oapi-codegen + sqlc)
cd backend && make generate

# 2) 프론트엔드 (Orval)
cd frontend && npm run generate:api
```

- **백엔드 동작**: `oapi-codegen`이 `api/openapi.yaml`을 읽어 `internal/handler/openapi.gen.go`에 `ServerInterface`, 요청/응답 구조체, `ServerInterfaceWrapper`, `std-http` 라우팅 코드를 생성합니다.
- **프론트엔드 동작**: `orval.config.js` 설정에 따라 `src/api/generated/model/`에 TypeScript 인터페이스, `src/api/generated/<tag>/`에 `src/lib/axios.ts`(`customInstance`) 기반 TanStack Query v5 훅(`useGet...`, `usePost...` 등)을 생성합니다.
- **엄격 금지 사항**:
  - `backend/internal/handler/openapi.gen.go` 및 `frontend/src/api/generated/` 하위 파일은 **절대 수동으로 편집하지 않습니다.**
  - 코드 생성 누락을 우회하기 위해 별도의 수동 wrapper 파일(`openapi_*_wrapper.go` 등)을 생성하지 않습니다. 생성 결과가 의도와 다르면 `backend/api/openapi.yaml`을 수정한 뒤 `make generate`를 다시 실행하세요.

---

### Step 3: 백엔드 계층별 구현 (Handler ➔ Service ➔ Repository)

1. **Handler 계층 (`backend/internal/handler/<domain>_handler.go`)**:
   - `internal/handler/openapi.gen.go`의 `ServerInterface`에 추가된 메서드 시그니처를 확인하고, 도메인별 핸들러 파일에 `*Server` 리시버 메서드로 구현합니다.
   - 핸들러는 **경로/쿼리 파라미터 추출, JSON 바디 디코딩(`ParseJSON` 또는 바디 크기 제한 디코딩), 입력값 검증, HTTP 상태 코드 및 JSON 응답 반환(`internal/handler/response.go` 헬퍼 활용)**만 담당합니다.
   - 클라이언트에 다국어로 안내해야 하는 비즈니스 에러는 `RespondErrorCode(w, status, code, message)`를 사용하여 머신 리더블 `code`를 함께 내려주고, 프론트엔드 `src/i18n/locales/{ko,ja,en,zh}.json`의 `errors.api.<code>` (`src/lib/apiError.ts`)와 연동합니다. 일반 에러는 `RespondError(w, status, message)`를 사용합니다.
   - 인증이 필요한 API는 `middleware`가 `r.Context()`에 주입한 유저 ID(`middleware.UserIDKey`)를 추출하여 Service로 전달합니다.
2. **Service 계층 (`backend/internal/service/<domain>_service.go`)**:
   - 첫 번째 인자로 반드시 `ctx context.Context`를 받습니다.
   - `http.Request`나 `http.ResponseWriter`에 의존하지 않는 순수 Go 도메인 로직을 작성하고, DB 작업이 필요하면 `internal/repository`의 `sqlc` 메서드를 호출합니다.
   - **서버리스 제약**: AWS Lambda 환경에서도 동일하게 동작하므로 백그라운드 고루틴을 띄우지 않습니다. 지연 평가가 필요한 작업은 `CreditService.MaybeProcessSustainedLifecycle(ctx)` 패턴을 참고하세요.

---

### Step 4: 검증 (Validation) & 문서 동기화

구현이 끝나면 반드시 백엔드 컴파일/테스트와 프론트엔드 타입 체크가 통과하는지 확인합니다.

```bash
# 백엔드 컴파일 및 테스트 검증
cd backend && go build ./... && go test ./...

# 프론트엔드 TypeScript 타입 검증
cd frontend && npx tsc --noEmit
```

- 엔드포인트, 요청/응답 스펙, 권한 정책이 변경된 경우 `wiki/API_SPECIFICATION.md` 등 관련 위키 문서도 함께 동기화합니다.

---

### Step 5: 작업 결과 요약
완료 후 사용자에게 다음 항목을 요약하여 보고합니다:
1. 추가/수정된 Endpoint (`METHOD /path`) 및 `operationId`
2. 생성된 프론트엔드 훅 경로 및 이름 (`frontend/src/api/generated/<tag>/` 내 `use...`)
3. 구현된 백엔드 Handler 및 Service 메서드 위치
4. 검증 명령(`go build`, `go test`, `tsc --noEmit`) 실행 결과
