---
name: add-new-api
description: OpenAPI 명세서 수정부터 백엔드/프론트엔드 코드 자동 생성 및 구현까지, 새로운 API를 추가할 때 따라야 하는 워크플로우 가이드입니다.
---

# 🚀 새로운 API 추가 워크플로우 (Add New API)

이 스킬은 Eventer Map 프로젝트에서 새로운 API 엔드포인트를 추가할 때 에이전트가 수행해야 할 구체적인 스텝을 정의합니다. 코드를 작성하거나 수정할 때 이 가이드를 엄격하게 따르세요.

## 📋 단계별 실행 가이드

### Step 1: OpenAPI 명세서 업데이트
1. `backend/api/openapi.yaml` 파일을 엽니다.
2. 새롭게 추가할 API의 `path`, `method`, `requestBody`, `responses`, 그리고 중요한 **`operationId`**를 스펙에 맞게 정의합니다.
   * 주의: `operationId`는 백엔드의 핸들러 함수 이름과 프론트엔드의 훅 이름(`use[OperationId]`)이 되므로 직관적인 CamelCase로 작성해야 합니다.

### Step 2: 백엔드/프론트엔드 코드 자동 생성
터미널을 열고 다음 명령어를 실행하여 코드를 자동 생성합니다. 이 과정에서 에러가 발생하면 반드시 수정하고 넘어가야 합니다.

**백엔드(Go) 생성 명령어:**
```bash
cd backend
go generate ./... # 또는 oapi-codegen 명령어 직접 실행
```
* 결과: `backend/internal/handler/openapi.gen.go` 파일 등에 라우팅 인터페이스와 모델 구조체가 갱신됩니다.

**프론트엔드(React) 생성 명령어:**
```bash
cd frontend
npm run generate:api
```
* 결과: `frontend/src/api/generated/` 폴더 하위에 `use[OperationId]` 형식의 React Query 훅과 Axios 함수가 생성됩니다.

### Step 3: 백엔드 계층별 로직 구현 (Handler ➔ Service)
1. **Handler 계층 (`internal/handler/`)**:
   * 생성된 인터페이스에 맞춰 핸들러 함수를 추가/수정합니다.
   * HTTP Request/Response 처리에만 집중하며, 복잡한 비즈니스 로직은 작성하지 않습니다.
   * 필요한 파라미터를 추출하고 검증한 뒤, Service 계층으로 넘깁니다.
2. **Service 계층 (`internal/service/`)**:
   * 실제 비즈니스 로직을 구현합니다.
   * 첫 번째 파라미터로 항상 `ctx context.Context`를 전달받아야 합니다.
   * DB 조회가 필요하다면 Repository(sqlc) 메서드를 호출합니다.

### Step 4: 변경 사항 요약
모든 작업이 완료되면 사용자에게 다음 정보를 보고합니다.
1. 추가된 API의 Method와 Endpoint (`GET /events` 등)
2. 생성된 프론트엔드 훅 이름 (`useGetEvents` 등)
3. 수정한 백엔드 핸들러 및 서비스 함수 이름
