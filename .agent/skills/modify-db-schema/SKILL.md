---
name: modify-db-schema
description: >-
  Use this skill when modifying the PostgreSQL database schema or adding/updating SQL queries in Eventer Map.
  Covers creating golang-migrate migration files, writing type-safe SQL queries in backend/db/query/,
  generating Go repository code with sqlc into backend/internal/repository/, and wiring it into the Service layer.
---

# 🗄️ 데이터베이스 스키마 및 SQL 쿼리 변경 워크플로우 (Modify DB Schema & Queries)

Eventer Map 프로젝트는 ORM을 사용하지 않으며, `golang-migrate`로 스키마를 관리하고 `sqlc`를 통해 `backend/internal/repository/`에 타입 안전한 Go 코드를 생성합니다.

---

## 📋 단계별 실행 가이드

### Step 1: 신규 마이그레이션 파일 생성 (스키마 변경 시)
기존 마이그레이션 파일(`backend/db/migration/*`)은 **절대 수정하지 말고**, 항상 새로운 시퀀스 마이그레이션 파일을 생성합니다. (단순 쿼리만 추가/수정하는 경우 Step 3으로 이동합니다.)

```bash
cd backend
go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest create -ext sql -dir db/migration -seq <변경사항_이름>
# 예시: ... -seq add_venue_capacity_column
```
- **결과**: `backend/db/migration/` 폴더에 `<버전>_<이름>.up.sql`과 `<버전>_<이름>.down.sql`이 생성됩니다.

---

### Step 2: DDL 작성 및 마이그레이션 적용

1. **`.up.sql` 작성**:
   - **외래키 정책**: 유저 탈퇴 시에도 보존되어야 하는 핵심 엔티티(이벤트, 아티스트, 공연장, 히스토리 등)의 유저 참조는 `ON DELETE SET NULL`을 사용합니다.
   - **인덱스 설계**: 전방 일치 자동완성 검색에는 `varchar_pattern_ops`, 위치 좌표 검색에는 Box/공간 인덱스를 고려합니다.
2. **`.down.sql` 작성**:
   - `.up.sql`의 변경 사항을 안전하게 되돌리는 역방향 DDL(`DROP TABLE`, `ALTER TABLE ... DROP COLUMN` 등)을 작성합니다.
3. **로컬/개발 DB 반영**:
   ```bash
   cd backend
   make migrateup
   ```
   *(DB 연결이 필요한 작업이므로, 샌드박스나 환경변수 문제로 실행할 수 없는 경우 사용자에게 실행을 안내하거나 승인을 요청합니다.)*

---

### Step 3: SQL 쿼리 작성 (`backend/db/query/*.sql`)

`backend/db/query/` 하위의 도메인별 `.sql` 파일에 쿼리를 추가하거나 수정합니다.

1. **sqlc 매직 주석 필수**:
   - `-- name: <FuncName> :one` (단건 반환)
   - `-- name: <FuncName> :many` (다건 슬라이스 반환)
   - `-- name: <FuncName> :exec` (반환값 없음)
   - `-- name: <FuncName> :execrows` (영향받은 행 수 반환)
2. **커서 기반 페이지네이션 (Cursor Pagination)**:
   - 대량 목록 조회 시 `LIMIT + OFFSET` 대신 `WHERE id > @cursor_id` (또는 정렬 기준 컬럼 비교) 방식을 사용합니다.
3. **조건부 업데이트 (Conditional Update)**:
   - 부분 업데이트 쿼리는 `sqlc.narg()`와 `COALESCE()`를 결합합니다:
     ```sql
     -- name: UpdateVenue :one
     UPDATE venues
     SET
       name = COALESCE(sqlc.narg('name'), name),
       address = COALESCE(sqlc.narg('address'), address),
       updated_at = NOW()
     WHERE id = sqlc.arg('id')
     RETURNING *;
     ```

---

### Step 4: `sqlc` 코드 자동 생성

`backend/sqlc.yaml` 설정에 따라 `db/migration`과 `db/query`를 검증하고 Go 코드를 생성합니다.

```bash
cd backend
make generate
```
- **결과**: `backend/internal/repository/` 폴더 내의 `models.go`, `db.go`, `<domain>.sql.go`, `querier.go`가 자동 갱신됩니다.
- *주의*: `backend/internal/repository/*.go` 파일은 절대 수동으로 편집하지 않습니다.

---

### Step 5: Service 계층 연동 및 컴파일 검증

1. `backend/internal/service/`에서 `s.repo.<FuncName>(ctx, params)` 형태로 생성된 메서드를 호출합니다.
2. 컴파일 에러가 없는지 검증합니다:
   ```bash
   cd backend && go build ./...
   ```
