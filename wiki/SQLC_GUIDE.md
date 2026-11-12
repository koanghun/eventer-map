# 🚀 sqlc 가이드 및 사용 설명서

[⬅️ 홈으로 돌아가기](./Home.md) | [관련 문서: DB 테이블 스키마 명세](./DATABASE_SCHEMA.md) | [관련 문서: DB 마이그레이션 가이드](./DATABASE_MIGRATION_GUIDE.md)

본 문서는 Eventer Map 백엔드 프로젝트에서 데이터베이스 접근과 쿼리를 관리하기 위해 도입된 **sqlc** 도구에 대한 가이드입니다.

---

## 1. sqlc 란?
[sqlc](https://sqlc.dev/)는 개발자가 직접 작성한 순수 SQL 쿼리를 읽고, 타입 안전(Type-safe)한 Go 언어 코드를 **자동으로 생성**해 주는 컴파일러(도구)입니다.

### 도입 효과
- **타입 안정성 보장**: 런타임이 아닌 컴파일 타임에 SQL 구문 및 타입 에러를 잡아낼 수 있습니다.
- **ORM 오버헤드 제거**: GORM 등 무거운 ORM 대신 순수 SQL의 강력함과 성능을 그대로 활용할 수 있습니다.
- **예측 가능성**: 인덱스(예: `varchar_pattern_ops` 전방 일치 인덱스, 바운딩 박스 인덱스)를 정확하게 타는 최적화된 쿼리를 직접 제어할 수 있습니다.

---

## 2. 작업 흐름 (Workflow)

sqlc를 이용해 새로운 데이터베이스 기능을 추가하는 흐름은 다음과 같습니다.

### 단계 1: 데이터베이스 스키마(Migration) 정의
테이블이 변경되거나 새로 생성될 경우, `backend/db/migration/` 폴더 내에 신규 `.up.sql` / `.down.sql` 마이그레이션 파일을 작성합니다. sqlc는 이 마이그레이션 파일들을 순서대로 읽어 Go 구조체 모델(`internal/repository/models.go`)을 생성합니다.

### 단계 2: SQL 쿼리 작성 (`backend/db/query/`)
`backend/db/query/` 디렉터리의 도메인별 SQL 파일(`artist.sql`, `venue.sql`, `event.sql`, `event_thread.sql`, `user.sql` 등)에 쿼리를 작성합니다.
반드시 상단에 **sqlc 매직 주석**을 달아 쿼리의 이름과 반환 형태를 지정해야 합니다.

```sql
-- name: SearchVenues :many
SELECT
    id,
    official_name,
    address,
    latitude,
    longitude,
    rating_sum,
    rating_count,
    status
FROM venues
WHERE
    status != 'REJECTED'
    AND LOWER(official_name) LIKE LOWER(sqlc.arg('query')::varchar) || '%'
ORDER BY
    CASE WHEN status = 'APPROVED' THEN 0 ELSE 1 END,
    official_name ASC
LIMIT sqlc.arg('limit');
```

> **매직 주석 규칙**:
> - `:one` : 1개의 row를 리턴할 때 (예: `SELECT ... LIMIT 1`, `INSERT ... RETURNING *`)
> - `:many` : 여러 개의 row를 리턴할 때 (예: 목록 및 자동완성 조회)
> - `:exec` : 리턴되는 데이터가 없을 때 (예: 단독 `INSERT`, `UPDATE`, `DELETE`)
> - `:execrows` : 영향을 받은 row의 개수를 리턴받고 싶을 때

### 단계 3: Go 코드 자동 생성
`backend` 디렉터리에서 `make generate` (또는 `sqlc generate`)를 실행합니다.

```bash
cd backend
make generate
```

명령이 성공적으로 실행되면 `backend/internal/repository/` 경로에 아래와 같은 파일들이 생성/업데이트됩니다 (**수동 수정 금지**):
- `models.go`: 스키마를 바탕으로 만들어진 도메인 구조체들 (`User`, `Artist`, `Venue`, `Event` 등)
- `artist.sql.go`, `venue.sql.go`, `event.sql.go` 등: 타입 안전한 DB 쿼리 메서드들
- `db.go`: `DBTX` 인터페이스 및 `Queries` 객체

---

## 3. Go 코드에서 사용법 (`internal/service` 계층)

생성된 `repository.Queries` 코드는 `internal/service/` 계층에서 주입받아 호출합니다.

```go
package service

import (
    "context"
    "database/sql"
    "strings"

    "eventer-map-backend/internal/repository"
    "github.com/google/uuid"
)

func (s *ArtistService) CreateArtist(ctx context.Context, input CreateArtistInput) (*repository.Artist, error) {
    params := repository.CreateArtistParams{
        OfficialName: strings.TrimSpace(input.OfficialName),
        Gender:       input.Gender,
        Status:       "PENDING",
        AuthorID:     uuid.NullUUID{UUID: input.AuthorID, Valid: input.AuthorID != uuid.Nil},
    }
    if input.Disambiguation != nil && strings.TrimSpace(*input.Disambiguation) != "" {
        params.Disambiguation = sql.NullString{String: strings.TrimSpace(*input.Disambiguation), Valid: true}
    }

    artist, err := s.repo.CreateArtist(ctx, params)
    if err != nil {
        return nil, err
    }
    return &artist, nil
}
```

---

## 4. 설정 파일 (`backend/sqlc.yaml`)

`backend/sqlc.yaml`이 sqlc의 코드 생성 경로와 패키지명을 제어합니다.

```yaml
version: "2"
sql:
  - schema: "db/migration"          # 스키마(테이블) 마이그레이션 위치
    queries: "db/query"             # SQL 쿼리문 작성 위치
    engine: "postgresql"
    gen:
      go:
        package: "repository"       # 생성될 Go 패키지명
        out: "internal/repository"  # 생성될 Go 코드가 저장될 위치
```

---

## 5. SQL 작성 핵심 규칙

1. **커서 기반 페이지네이션 (Cursor Pagination)**:
   - 대량 데이터 조회 시 `LIMIT + OFFSET`을 지양하고 커서 방식을 사용합니다.
   - 단일 ID 기준: `WHERE id > @cursor_id`
   - **복합 랭킹 기준 (이벤트 스레드 추천순 등)**: 정렬 조건이 `recommend_count DESC, created_at DESC, id DESC`와 같이 복합적일 때는 PostgreSQL의 튜플 비교 문법을 사용하여 동점자 누락 없이 인덱스를 고속 스캔합니다:
     ```sql
     -- name: ListEventThreads :many
     SELECT ... FROM event_threads t
     WHERE t.event_id = @event_id
       AND (
         sqlc.narg('cursor_id')::uuid IS NULL
         OR (t.recommend_count, t.created_at, t.id) < (
             sqlc.narg('cursor_recommend_count')::int,
             sqlc.narg('cursor_created_at')::timestamptz,
             sqlc.narg('cursor_id')::uuid
         )
       )
     ORDER BY t.recommend_count DESC, t.created_at DESC, t.id DESC
     LIMIT @row_limit;
     ```
2. **조건부 업데이트 (Conditional Update)**:
   - 일부 필드만 선택적으로 수정하는 쿼리는 `COALESCE(sqlc.narg('field'), field)` 패턴을 사용합니다.
3. **전방 일치 자동완성 인덱스 활용**:
   - 공연장(`SearchVenues`) 및 출연자(`ListArtists`) 검색은 `LOWER(official_name) LIKE LOWER(@query) || '%'` 형태로 작성하여 `varchar_pattern_ops` B-Tree 인덱스를 타도록 유지합니다.
4. **차단 유저 서브쿼리 필터링 (`NOT EXISTS`)**:
   - 커뮤니티 및 참가자 목록 조회 시 조회자와 상호 차단 관계에 있는 유저의 데이터는 SQL 레벨에서 제외합니다.
5. **다중 엔티티 CTE 중복 제거 패턴 (`ListFollowingArtistsEventsForMap`)**:
   - 팔로우 중인 여러 출연자가 같은 이벤트에 동시에 참가할 경우 행 중복이 발생하지 않도록 `WITH followed_event_ids AS (SELECT DISTINCT ea.event_id FROM user_artist_follows uaf JOIN event_artists ea ON ea.artist_id = uaf.artist_id WHERE uaf.user_id = sqlc.arg('user_id'))` CTE로 먼저 이벤트 ID를 추린 뒤 `events`와 조인합니다.
   - 내 액션 필터(`ListMyActionEvents`)처럼 동일 테이블을 다른 목적으로 조회하는 쿼리에서는 `sqlc.arg('user_id')` / `sqlc.arg('action_status')`를 활용해 `idx_event_user_actions_user_status_event` 복합 인덱스를 직접 타도록 설계합니다.
