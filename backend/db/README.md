# Eventer Map Database Guide

이 문서는 Eventer Map 프로젝트의 데이터베이스 스키마 설계, 쿼리 구조 및 작업(Workflow) 방식에 대한 가이드입니다.

## 🛠 Tech Stack
- **Database**: PostgreSQL
- **Migration**: [golang-migrate](https://github.com/golang-migrate/migrate) (스키마 버전 관리)
- **Code Generator**: [sqlc](https://github.com/sqlc-dev/sqlc) (SQL 쿼리를 Go 코드로 자동 생성)

---

## 🏛 Schema Design (`migration/`)

데이터베이스 스키마는 크게 핵심 도메인과 위키(협업) 도메인으로 나뉩니다. 유저가 탈퇴하더라도 정보가 유지되어야 하는 핵심 엔티티들의 `author_id`는 `ON DELETE CASCADE` 대신 `ON DELETE SET NULL` 방식을 사용합니다.

### 1. 주요 테이블
* **`users`**: 자체 이메일 로그인 및 소셜(Google) 로그인 지원.
* **`artists`**: 아티스트 기본 정보 및 평점 런닝 토탈 관리.
* **`venues`**: 공연장 위치 정보(위도, 경도) 및 기본 정보 관리.
* **`events`**: 이벤트 정보. `venue_id`를 외래키로 가지며, 특정 아티스트 다수 참여 시 `event_artists` N:M 매핑 테이블 사용.

### 2. 커뮤니티 및 위키 시스템
* **`event_threads`**: 이벤트 내 자유 대화 및 부가 정보 스레드.
* **`thread_recommendations`**: 동일 유저의 중복 스레드 추천 어뷰징 방지 매핑.
* **`event_histories`**: 위키 성격의 이벤트 수정 이력 스냅샷(JSONB) 보존.
* **`history_reports`**: 잘못된 정보 롤백 유도를 위한 누적 신고 시스템.

### 3. 인덱스 (Indexes) 최적화 전략
* **자동완성 (Like 검색)**: `artists`와 `venues`의 이름 검색 시 전체 풀스캔 방지를 위해 **`varchar_pattern_ops`** 옵션을 적용한 B-Tree 인덱스 사용. (`LIKE '검색어%'` 전방 일치 최적화)
* **지도 Bounding Box 검색**: `venues` 테이블의 `(latitude, longitude)` 복합 B-Tree 인덱스를 통한 사각형 범위 내 핀 표시 최적화.
* **이벤트 필터링**: `events` 테이블의 `start_time` 단일 인덱스 적용 (기간 기반 조회 속도 향상).

---

## 🔍 Query Design (`query/`)

`sqlc`는 개발자가 직접 작성한 `.sql` 파일을 읽어 안전한 Go 타입 구조체와 함수로 변환해 줍니다. 

### 1. 커서 기반 페이지네이션 (Cursor Pagination)
지도 앱 특성상 무한 스크롤 및 고속 조회를 위해 쿼리에 `LIMIT + OFFSET` 대신 **커서(Cursor)** 방식을 전면 적용했습니다.
- 앞선 페이지의 마지막 데이터 기준값(`id` 또는 `start_time`)을 파라미터(`@cursor_id`)로 넘겨 인덱스를 활용해 조회합니다.
- 예: `WHERE id > @cursor_id ORDER BY id ASC LIMIT $1`

### 2. 조건부 업데이트 (Conditional Update)
`sqlc.narg()` 문법과 `COALESCE` 함수를 결합해, 값이 들어온(수정된) 필드만 업데이트하고 값이 비어있는(NULL) 필드는 기존 값을 유지하도록 쿼리를 작성했습니다.

---

## 🚀 Workflow (DB 작업 방법)

DB에 새로운 테이블을 추가하거나 쿼리를 수정해야 할 때는 반드시 아래 3단계를 거칩니다.

### Step 1. 마이그레이션(스키마) 수정
새로운 테이블이나 컬럼이 필요하면 `db/migration/` 폴더 하위에 새 버전을 만듭니다. (또는 개발 초기라면 `000001_init_schema.up.sql`을 직접 수정합니다.)

### Step 2. SQL 쿼리 작성
원하는 CRUD 로직에 맞춰 `db/query/{domain}.sql` 파일에 SQL 구문을 작성합니다.
* 쿼리 위에 반드시 주석으로 `sqlc` 어노테이션(`-- name: MethodName :one` 또는 `:many`, `:exec`)을 붙여야 합니다.

```sql
-- 예시
-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1 LIMIT 1;
```

### Step 3. Go 코드 자동 생성 (`sqlc generate`)
쿼리 작성이 끝났다면 터미널에서 `backend` 폴더로 이동한 후 `sqlc`를 실행합니다.

```bash
cd backend
sqlc generate
```
실행이 성공하면 `backend/internal/repository/` 하위에 방금 작성한 쿼리들에 대응하는 Go 언어 함수가 자동으로 생성됩니다! (직접 수정 금지)
