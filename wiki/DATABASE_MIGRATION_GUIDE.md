# 🗄️ Database Migration Guide

[⬅️ 홈으로 돌아가기](./Home.md) | [관련 문서: SQLC 가이드](./SQLC_GUIDE.md)

Eventer Map 백엔드는 Go 생태계의 표준 도구인 [`golang-migrate/migrate`](https://github.com/golang-migrate/migrate)를 사용하여 데이터베이스 스키마와 마이그레이션을 관리합니다.

이 문서는 로컬 개발 및 프로덕션 환경에서 DB 스키마를 초기화하고 버전을 관리하는 방법을 설명합니다.

---

## 1. 🚀 Makefile을 통한 간편 실행 (권장)

`backend/Makefile`에 마이그레이션 명령어가 정의되어 있어 별도의 전역 바이너리 설치 없이도 `backend/.env`의 `DATABASE_URL`을 읽어 바로 실행할 수 있습니다.

```bash
cd backend

# 미적용 마이그레이션 모두 적용 (Up)
make migrateup

# 마이그레이션 롤백 (Down)
make migratedown

# 현재 마이그레이션 버전 확인
make migrateversion
```

---

## 2. 🗂️ 마이그레이션 파일 구조 및 이력

DB의 스키마 변경 사항은 `backend/db/migration/` 폴더 안의 `.sql` 파일들로 관리됩니다.
새로운 테이블이나 컬럼, 인덱스를 추가할 때는 **이미 적용된 기존 파일을 절대 수정하지 않고** 새로운 시퀀스 번호의 마이그레이션 파일(`.up.sql`, `.down.sql`)을 생성합니다.

### 현재 마이그레이션 버전 이력 (`000001` ~ `000014`)

| 버전 | 파일명 | 주요 변경 내용 |
| :---: | :--- | :--- |
| `000001` | `000001_init_schema` | 초기 테이블 생성 (`users`, `artists`, `venues`, `events`, `event_artists`, `event_threads`, `event_histories` 등) |
| `000002` | `000002_add_nickname_unique` | `users.display_name` 고유(UNIQUE) 제약조건 추가 |
| `000003` | `000003_add_email_verification` | 이메일 인증 코드 테이블 및 컬럼 추가 |
| `000004` | `000004_add_event_user_actions` | 유저의 이벤트 체크(`1`) / 참가(`2`) 상태 테이블 생성 |
| `000005` | `000005_add_user_social` | 유저 간 팔로우(`user_follows`) 테이블 생성 |
| `000006` | `000006_add_artist_follows` | 아티스트 팔로우(`artist_follows`) 테이블 생성 |
| `000007` | `000007_add_daily_visits` | 일일 방문자 수 집계(`daily_visits`) 테이블 생성 |
| `000008` | `000008_add_roles_and_ratings` | 유저 권한(`role: USER/ADMIN`) 및 아티스트/공연장 평점 테이블 추가 |
| `000009` | `000009_add_credit_scores` | 아티스트/공연장 자동 승인을 위한 신용점수(`credit_score`, `credit_count`) 추가 |
| `000010` | `000010_add_event_performance_indexes` | 이벤트 날짜/공연장 복합 조회 성능 인덱스 추가 |
| `000011` | `000011_add_venue_lower_name_pattern_index` | 공연장 자동완성 전방 일치 검색용 인덱스 (`LOWER(official_name) varchar_pattern_ops`) |
| `000012` | `000012_add_artist_lower_name_pattern_index` | 출연자 자동완성 전방 일치 검색용 인덱스 (`LOWER(official_name) varchar_pattern_ops`, `hiragana varchar_pattern_ops`) |
| `000013` | `000013_remove_artist_dates_and_restrict_gender` | `artists` 테이블에서 `birth_date`, `debut_date` 제거 및 `gender IN ('MALE', 'FEMALE')` 제약조건 적용 |
| `000014` | `000014_add_artist_disambiguation` | 동명이인 출연자 구분을 위한 `artists.disambiguation VARCHAR(100)` 컬럼 추가 |

### 새 마이그레이션 파일 생성 명령어
```bash
migrate create -ext sql -dir backend/db/migration -seq <변경_설명>
```

---

## 3. ⚙️ Migrate CLI 직접 실행 (Up / Down)

`migrate` CLI가 설치된 환경에서는 아래와 같이 직접 실행할 수도 있습니다.

```bash
# 스키마 적용 (Migration UP)
migrate -path backend/db/migration -database "$DATABASE_URL" up

# 스키마 1단계 롤백 (Migration DOWN)
migrate -path backend/db/migration -database "$DATABASE_URL" down 1
```

---

## 4. 💡 문제 해결 (Troubleshooting)

> [!WARNING]
> **Dirty Database Error 해결법**
>
> 마이그레이션을 실행하다가 SQL 문법 오류 등으로 인해 실패하면 데이터베이스가 `dirty` 상태로 잠기게 됩니다.
>
> **해결 방법:**
> 1. DB 툴이나 `psql`로 접속하여 실패한 변경사항을 수동으로 정리합니다.
> 2. 터미널에서 `force` 명령어를 사용하여 직전 정상 버전 번호로 강제 복구합니다.
> ```bash
> migrate -path backend/db/migration -database "$DATABASE_URL" force [직전_정상_버전_번호]
> ```
> 3. SQL 스크립트의 오류를 수정한 후 다시 `make migrateup`을 실행합니다.
