---
name: modify-db-schema
description: golang-migrate를 이용한 데이터베이스 마이그레이션 파일 생성 및 sqlc를 이용한 쿼리, Go 모델 코드 자동 생성 워크플로우 가이드입니다.
---

# 🗄️ 데이터베이스 스키마 변경 워크플로우 (Modify DB Schema)

이 스킬은 Eventer Map 프로젝트에서 테이블 스키마를 변경(테이블/컬럼 추가, 삭제 등)하거나 새로운 쿼리를 추가할 때 에이전트가 수행해야 할 구체적인 스텝을 정의합니다.

## 📋 단계별 실행 가이드

### Step 1: 새 마이그레이션 파일 생성
데이터베이스 스키마를 변경하려면 기존 파일을 수정하지 말고 항상 새로운 마이그레이션 파일을 생성해야 합니다.

**실행 명령어:**
```bash
cd backend
migrate create -ext sql -dir db/migration -seq [변경사항을_설명하는_이름]
# 예시: migrate create -ext sql -dir db/migration -seq add_users_table
```
* 결과: `db/migration/` 폴더에 `[버전]_[이름].up.sql`과 `[버전]_[이름].down.sql` 두 개의 빈 파일이 생성됩니다.

### Step 2: 마이그레이션 SQL 작성 및 적용
1. 생성된 `.up.sql` 파일에 테이블 생성 또는 컬럼 추가/수정 SQL 문을 작성합니다.
2. 생성된 `.down.sql` 파일에 이전 상태로 롤백하는 SQL 문(Drop Table 등)을 작성합니다.
3. 터미널에서 다음 명령어를 실행하여 로컬 데이터베이스에 스키마를 적용합니다.
```bash
cd backend
migrate -path db/migration -database "$DATABASE_URL" up
```
*(참고: 에이전트가 로컬 DB에 접근할 수 없는 환경이라면 사용자에게 `up` 명령어 실행을 요청하세요.)*

### Step 3: SQL 쿼리 작성 (sqlc 용)
1. `backend/db/query/` 하위의 적절한 `.sql` 파일을 열거나 새로 만듭니다.
2. 새롭게 반영된 스키마를 바탕으로 SQL 쿼리문을 작성합니다.
3. 쿼리문 상단에는 반드시 sqlc 매직 주석을 작성해야 합니다.
```sql
-- name: CreateItem :one
INSERT INTO items (name) VALUES ($1) RETURNING *;
```

### Step 4: sqlc 코드 자동 생성
터미널을 열고 다음 명령어를 실행하여 Go 코드를 생성합니다.
```bash
cd backend
sqlc generate
```
* 결과: `backend/db/sqlc/` 폴더 내의 `models.go` 및 매핑된 Go 함수 파일들이 업데이트됩니다.

### Step 5: Service 계층에 반영
자동 생성된 sqlc 메서드(예: `store.CreateItem(ctx, ...)`)를 `internal/service/` 계층의 로직에 연동하고 수정 사항이 제대로 반영되었는지 확인합니다.
