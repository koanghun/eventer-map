# 🚀 sqlc 가이드 및 사용 설명서

본 문서는 Eventer Map 백엔드 프로젝트에서 데이터베이스 접근과 쿼리를 관리하기 위해 도입된 **sqlc** 도구에 대한 가이드입니다.

---

## 1. sqlc 란?
[sqlc](https://sqlc.dev/)는 개발자가 직접 작성한 순수 SQL 쿼리를 읽고, 타입 안전(Type-safe)한 Go 언어 코드를 **자동으로 생성**해 주는 컴파일러(도구)입니다.

### 도입 효과
- **타입 안정성 보장**: 런타임이 아닌 컴파일 타임에 SQL 구문 및 타입 에러를 잡아낼 수 있습니다.
- **ORM 오버헤드 제거**: GORM 등 무거운 ORM 대신 순수 SQL의 강력함과 성능을 그대로 활용할 수 있습니다.
- **예측 가능성**: 쿼리가 어떻게 실행될지 명확하게 알 수 있으며, 복잡한 JOIN 쿼리도 SQL 작성하듯 쉽게 짤 수 있습니다.

---

## 2. 작업 흐름 (Workflow)

sqlc를 이용해 새로운 데이터베이스 기능을 추가하는 흐름은 다음과 같습니다.

### 단계 1: 데이터베이스 스키마(Migration) 정의
테이블이 변경되거나 새로 생성될 경우, `backend/db/migration/` 폴더 내에 `.sql` 마이그레이션 파일을 작성합니다. sqlc는 이 스키마를 읽어 Go 구조체 모델(`models.go`)을 만듭니다.

### 단계 2: SQL 쿼 작성 (`db/query/`)
`backend/db/query/` 디렉터리에 새로운 SQL 파일을 만들거나 기존 파일에 쿼리를 추가합니다.
반드시 상단에 **sqlc 매직 주석**을 달아 쿼리의 이름과 반환 형태를 지정해야 합니다.

```sql
-- name: CreateUser :one
INSERT INTO users (
  email,
  display_name,
  password_hash
) VALUES (
  $1, $2, $3
) RETURNING *;

-- name: ListUsers :many
SELECT * FROM users
ORDER BY created_at DESC;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;
```

> **주석 규칙**:
> - `:one` : 1개의 row를 리턴할 때 (ex. SELECT 1건, RETURNING 절)
> - `:many` : 여러 개의 row를 리턴할 때 (ex. SELECT 목록)
> - `:exec` : 리턴되는 데이터가 없을 때 (ex. INSERT, UPDATE, DELETE 단독 실행)
> - `:execrows` : 영향을 받은 row의 개수를 리턴받고 싶을 때

### 단계 3: Go 코드 자동 생성
터미널에서 `backend` 디렉터리로 이동한 뒤, 아래 명령어를 실행합니다.

```bash
cd backend
sqlc generate
```

명령이 성공적으로 실행되면, `backend/db/sqlc/` 경로에 아래와 같은 파일들이 생성/업데이트 됩니다.
- `models.go`: 스키마를 바탕으로 만들어진 구조체들 (ex. `type User struct {...}`)
- `user.sql.go`, `event.sql.go` 등: 실제로 DB와 통신하는 쿼리 메서드들
- `db.go`: `DBTX` 인터페이스 및 `Queries` 객체

---

## 4. Go 코드에서 사용법 (Service / Handler 계층)

생성된 코드는 주로 `internal/service` 내에서 사용됩니다.

```go
package service

import (
    "context"
    "eventer-map/db/sqlc"
)

type UserService struct {
    store sqlc.Store // 쿼리를 감싸고 있는 스토어 객체
}

func (s *UserService) RegisterUser(ctx context.Context, email, nickname, password string) (*sqlc.User, error) {
    // sqlc가 자동 생성한 CreateUser 메서드 호출
    user, err := s.store.CreateUser(ctx, sqlc.CreateUserParams{
        Email:        email,
        DisplayName:  nickname,
        PasswordHash: password, // (실제론 해싱된 값 사용)
    })
    
    if err != nil {
        return nil, err
    }
    
    return &user, nil
}
```

---

## 5. 설정 파일 (`sqlc.yaml`)

`backend` 디렉터리 최상단에 있는 `sqlc.yaml`이 sqlc의 동작 방식을 제어합니다.

```yaml
version: "2"
sql:
  - schema: "db/migration"       # 스키마(테이블) 정의 위치
    queries: "db/query"          # SQL 쿼리문 작성 위치
    engine: "postgresql"
    gen:
      go:
        package: "sqlc"          # 생성될 Go 패키지명
        out: "db/sqlc"           # 생성될 Go 코드가 저장될 위치
        emit_json_tags: true     # JSON 직렬화를 위한 태그 자동 생성
        emit_prepared_queries: false
        emit_interface: false
        emit_exact_table_names: false
```

---

## 6. 자주 묻는 질문 (FAQ)

**Q. `sqlc generate`를 실행했는데 에러가 납니다.**
A. 가장 흔한 원인은 다음과 같습니다.
1. `db/query` 내의 SQL 문법이 틀렸거나, 컬럼명을 잘못 타이핑한 경우.
2. `db/migration` 내의 스키마에 존재하지 않는 컬럼이나 테이블을 쿼리에서 사용한 경우. (반드시 마이그레이션 파일과 쿼리가 일치해야 합니다.)

**Q. 쿼리 파라미터가 3개가 넘어가서 구조체로 받고 싶어요.**
A. 파라미터 개수가 늘어나면 sqlc가 알아서 `CreateUserParams`와 같은 인자(arg) 전용 구조체를 자동 생성해 주므로 신경 쓰지 않아도 됩니다.

**Q. Null 가능한(Nullable) 컬럼 처리는 어떻게 되나요?**
A. 데이터베이스에서 `NOT NULL`이 아닌 컬럼은 Go 코드에서 `sql.NullString`, `sql.NullInt32` 등으로 자동 변환되어 안전하게 핸들링할 수 있게 됩니다. (필요 시 pgx 관련 타입을 사용하도록 오버라이딩 할 수도 있습니다.)
