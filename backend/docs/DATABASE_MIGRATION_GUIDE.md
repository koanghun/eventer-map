# 🗄️ Database Migration Guide

Eventer Map 백엔드는 Go 생태계의 표준 도구인 [`golang-migrate/migrate`](https://github.com/golang-migrate/migrate)를 사용하여 데이터베이스 스키마와 마이그레이션을 관리합니다.

이 문서는 로컬 개발 및 프로덕션 환경에서 DB 스키마를 초기화하고 버전을 관리하는 방법을 설명합니다.

---

## 1. 🚀 Migrate CLI 설치

마이그레이션 명령어를 실행하기 위해서는 `migrate` CLI 도구가 필요합니다.

**Go가 설치된 환경에서 설치하는 법:**
```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```
> 설치 후 `migrate` 명령어가 실행되지 않는다면, Go bin 경로(`$(go env GOPATH)/bin`)가 환경 변수 `PATH`에 등록되어 있는지 확인하세요.

**기타 환경 (Mac Homebrew 등):**
```bash
brew install golang-migrate
```

---

## 2. 🗂️ 마이그레이션 파일 구조

DB의 스키마 변경 사항은 `backend/db/migration/` 폴더 안의 `.sql` 파일들로 관리됩니다.

* `000001_init_schema.up.sql` : 스키마를 적용(Up)할 때 실행되는 SQL (테이블 생성 등)
* `000001_init_schema.down.sql` : 스키마를 롤백(Down)할 때 실행되는 SQL (테이블 삭제 등)

새로운 테이블이나 칼럼을 추가하고 싶을 때는 **기존 파일을 수정하지 마시고** 새로운 마이그레이션 파일을 생성해야 합니다.

### 새 마이그레이션 파일 생성 명령어
```bash
migrate create -ext sql -dir backend/db/migration -seq add_new_table
```
*결과: `000002_add_new_table.up.sql`, `000002_add_new_table.down.sql` 생성됨*

---

## 3. ⚙️ 마이그레이션 실행 (Up / Down)

터미널에서 DB에 SQL을 실행하여 스키마를 최신 상태로 만들거나 롤백할 수 있습니다.

### 스키마 적용 (Migration UP) - 테이블 생성
현재 버전에 맞춰 적용되지 않은 모든 `.up.sql` 파일들을 순차적으로 실행합니다.
```bash
migrate -path backend/db/migration -database "DATABASE_URL" up
```
*(예시: `migrate -path backend/db/migration -database "postgres://postgres:1234@ludwig1824.synology.me:6930/postgres?sslmode=disable" up`)*

### 스키마 롤백 (Migration DOWN) - 테이블 삭제
가장 최근에 적용한 마이그레이션 버전을 1단계 롤백(`.down.sql` 실행)합니다. (주의: 데이터가 삭제될 수 있습니다)
```bash
migrate -path backend/db/migration -database "DATABASE_URL" down 1
```

---

## 4. 💡 문제 해결 (Troubleshooting)

> [!WARNING]
> **Dirty Database Error 해결법**
> 
> 마이그레이션을 실행하다가 SQL 문법 오류 등으로 인해 실패하면, 데이터베이스가 `dirty` 상태로 잠기게 됩니다. 이 상태에서는 추가 마이그레이션을 실행할 수 없습니다.
> 
> **해결 방법:**
> 1. DB 툴이나 psql로 접속하여 실패한 테이블을 수동으로 정리(Drop)합니다.
> 2. 터미널에서 `force` 명령어를 사용하여 버전을 강제로 되돌립니다.
> ```bash
> migrate -path backend/db/migration -database "DATABASE_URL" force [직전 정상 버전 번호]
> ```
> *(예: `000002` 버전을 적용하다 실패했다면 `force 1` 실행)*
> 3. SQL 스크립트의 오류를 수정한 후 다시 `up` 명령어를 실행합니다.
