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

로컬에 설치된 `migrate` 바이너리(`/home/parkkh/go/bin/migrate`)를 사용하면 네트워크 없이 오프라인/샌드박스 환경에서도 즉시 파일을 생성할 수 있습니다:
```bash
cd backend
/home/parkkh/go/bin/migrate create -ext sql -dir db/migration -seq <변경사항_이름>
# 예시: ... -seq add_venue_capacity_column
```
- **결과**: `backend/db/migration/` 폴더에 `<버전>_<이름>.up.sql`과 `<버전>_<이름>.down.sql`이 생성됩니다.

---

### Step 2: DDL 작성 및 마이그레이션 적용

1. **`.up.sql` 작성**:
   - **외래키 정책**: 유저 탈퇴 시에도 보존되어야 하는 핵심 엔티티(`events`, `artists`, `venues`, `event_threads`, `modification_requests`)의 유저 참조는 `ON DELETE SET NULL`을 사용합니다.
   - **인덱스 설계**: 전방 일치 자동완성 검색에는 `LOWER(official_name) varchar_pattern_ops` / `hiragana varchar_pattern_ops`, 지도 좌표·목록 필터에는 복합/부분 인덱스(`idx_events_active_created_at`, `idx_event_user_actions_user_status_event` 등)를 고려합니다.
2. **`.down.sql` 작성**:
   - `.up.sql`의 변경 사항을 안전하게 되돌리는 역방향 DDL(`DROP TABLE`, `ALTER TABLE ... DROP COLUMN`, `DROP INDEX` 등)을 작성합니다.
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
   - 대량 목록 조회 시 `LIMIT + OFFSET` 대신 단일 커서(`WHERE id > @cursor_id`) 또는 **복합 튜플 커서**(`(t.recommend_count, t.created_at, t.id) < (sqlc.narg('cursor_recommend_count')::int, sqlc.narg('cursor_created_at')::timestamptz, sqlc.narg('cursor_id')::uuid)`) 방식을 사용합니다.
3. **차단 유저 필터링 & 다중 조인 중복 제거**:
   - 커뮤니티·목록 조회 시 상호 차단 유저는 `NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE ...)`로 SQL 레벨에서 제외합니다 (`event_thread.sql` 참고).
   - 1:N 관계 조인 시 중복 행 방지가 필요하면 `WITH followed_event_ids AS (SELECT DISTINCT ...)` CTE로 먼저 ID를 추린 뒤 본 테이블과 조인합니다 (`event.sql`의 `ListFollowingArtistsEventsForMap` 참고).
4. **조건부 업데이트 (Conditional Update)**:
   - 부분 업데이트 쿼리는 `sqlc.narg()`와 `COALESCE()`를 결합합니다:
     ```sql
     -- name: UpdateVenue :one
     UPDATE venues
     SET
       official_name = COALESCE(sqlc.narg('official_name'), official_name),
       address = COALESCE(sqlc.narg('address'), address),
       updated_at = NOW()
     WHERE id = sqlc.arg('id')
     RETURNING *;
     ```

---

### Step 4: `sqlc` 코드 자동 생성

`backend/sqlc.yaml` 설정에 따라 `db/migration`과 `db/query`를 검증하고 Go 코드를 생성합니다. (`sqlc` 바이너리는 `/home/parkkh/go/bin`에 설치되어 있으며 `backend/Makefile`의 `PATH`로 실행됩니다.)

```bash
cd backend
make generate
```
- **결과**: `backend/internal/repository/` 폴더 내의 `models.go`, `db.go`, `<domain>.sql.go` 파일이 자동 갱신됩니다.
- *주의*: `backend/internal/repository/*.go` 파일은 **절대 수동으로 편집하지 않습니다.**

---

### Step 5: Service 계층 연동, 검증 및 문서 동기화

1. `backend/internal/service/`에서 `s.repo.<FuncName>(ctx, params)` 형태로 생성된 메서드를 호출합니다.
2. 컴파일 에러 및 단위 테스트를 검증합니다:
   ```bash
   cd backend && go build ./... && go test ./...
   ```
3. 스키마 또는 마이그레이션 이력이 변경된 경우 `wiki/DATABASE_SCHEMA.md`와 `wiki/DATABASE_MIGRATION_GUIDE.md`도 함께 동기화합니다.
