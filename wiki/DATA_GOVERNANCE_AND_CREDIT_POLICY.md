# 🛡️ 데이터 신뢰도 시스템 (거버넌스 정책 · 신용 점수 · 수정 요청)

[⬅️ 홈으로 돌아가기](./Home.md) | [관련 문서: 시스템 아키텍처](./ARCHITECTURE.md) | [관련 문서: API 상세 설계서](./API_SPECIFICATION.md) | [관련 문서: DB 스키마](./DATABASE_SCHEMA.md)

본 문서는 Eventer Map의 **이원화 데이터 거버넌스(`PENDING` vs `APPROVED`)**, **커뮤니티 신용 점수(Credit Score) 기반 자동 승격·삭제**, **공인 데이터 수정 요청 및 신뢰 점수(Trust Score) 시스템**, 그리고 **AWS Lambda 서버리스 환경 대응 지연 평가(Lazy Evaluation) 아키텍처**의 설계와 실제 구현을 정리한 기술 문서입니다.

---

## 1. 🧭 개요 및 설계 철학 (Overview & Architecture Philosophy)

Eventer Map은 사용자가 공연장·아티스트·이벤트 정보를 자유롭게 등록하고 보완하는 **위키형 크라우드소싱 플랫폼**입니다. 동시에 허위·중복 정보나 공인 데이터 훼손(반달리즘)을 방지하기 위해 **2계층 커뮤니티 검증 + 관리자 거버넌스** 모델을 채택합니다.

1. **1계층 — 신규 엔티티 신용 점수 검증 (`Credit Score`)**:
   - 일반 유저가 등록한 데이터는 즉시 서비스에 노출되되 **`PENDING` (유저 데이터)** 상태로 시작합니다.
   - 커뮤니티의 `+1` / `-1` 투표(`MinCreditVotes = 5` 이상)를 통해 **순점수 `+5` 이상을 24시간 유지하면 `APPROVED`(공인 데이터)로 자동 승격**되고, **순점수 `-5` 이하를 24시간 유지하면 자동 삭제**됩니다.
2. **2계층 — 공인 데이터 수정 요청 및 신뢰 점수 검증 (`Modification Request & Trust Score`)**:
   - `APPROVED` 상태가 된 공인 데이터는 작성자 본인을 포함한 일반 유저가 직접 덮어쓸 수 없으며, 오직 **수정 요청(`modification_requests`)**으로만 변경을 제안할 수 있습니다.
   - 제안된 변경사항(`proposed_data`) 역시 커뮤니티 신뢰 점수 투표(`MinTrustVotes = 5` 이상)에서 **순점수 `+5` 이상을 24시간 유지하면 단일 트랜잭션으로 자동 반영(`APPLIED`)**되고, **`-5` 이하를 24시간 유지하면 자동 삭제**됩니다.

### 1.1. 만족도 평점(`rating`)과 데이터 신뢰도(`credit` / `trust`)의 역할 분리

Eventer Map은 초기 마이그레이션(`000008`~`000009`)에서 아티스트·공연장 자체 평가와 신용 점수를 혼용하던 구조를 정리하고, `000015` 및 `000021` 마이그레이션을 거치며 **서비스 품질/만족도 평가**와 **데이터 진위/신뢰도 검증**을 완전히 분리했습니다.

| 구분 | 만족도 평점 (`rating_sum`, `rating_count`) | 엔티티 신용 점수 (`credit_score`, `credit_count`) | 수정 요청 신뢰 점수 (`trust_score`, `trust_count`) |
| :--- | :--- | :--- | :--- |
| **목적** | 공연 경험에 대한 주관적 만족도 측정 | 등록된 엔티티 정보의 사실성·유효성 검증 | 공인 엔티티의 필드 수정 제안 타당성 검증 |
| **대상** | `events` (아티스트·공연장은 이벤트 평균에서 파생 캐시) | `events`, `artists`, `venues` | `modification_requests` (`APPROVED` 대상만 허용) |
| **참여 자격** | 이벤트 참가자(`event_user_actions.status = 2`) | 작성자 본인 제외한 모든 활성(`!is_banned`) 인증 유저 | 작성자 본인 제외한 모든 활성(`!is_banned`) 인증 유저 |
| **점수 체계** | 1~5점 정수 별점 (`user_event_ratings`) | `+1` / `-1` / `0`(취소) (`*_credit_votes`) | `+1` / `-1` / `0`(취소) (`modification_request_votes`) |
| **상태 영향** | 검색/대표 출연자 정렬 가중치에만 반영 | 24h 지속 조건 충족 시 `APPROVED` 승격 또는 `PENDING` 레코드 삭제 | 24h 지속 조건 충족 시 원 엔티티 자동 업데이트(`APPLIED`) 또는 요청 삭제 |

---

## 2. 📋 이원화 데이터 상태 모델 및 권한 매트릭스

### 2.1. 초기 상태 결정 (`CreateEvent` · `CreateArtist` · `CreateVenue`)

엔티티 생성 시 백엔드 서비스 계층(`event_service.go`, `artist_service.go`, `venue_service.go`)은 `users` 테이블에서 작성자 정보를 조회해 다음 순서로 초기 상태를 결정합니다.

1. `user.IsBanned == true` 인 경우 `ErrUserBanned`를 반환해 등록을 차단합니다(`403 Forbidden`, 단 `PostEvents`는 명시적 `403`, `PostArtists`/`PostVenues`는 현재 서비스 에러 전파 경로를 따름).
2. `user.Role == "ADMIN"` 인 경우 초기 `status = 'APPROVED'`로 즉시 공인 데이터로 생성합니다.
3. 일반 유저(`user.Role == "USER"`)인 경우 초기 `status = 'PENDING'`으로 생성합니다.

> [!NOTE]
> `events`, `artists`, `venues`의 `author_id` 외래키는 모두 **`ON DELETE SET NULL`**로 정의되어 있어, 최초 등록자가 회원 탈퇴하더라도 엔티티 데이터는 보존됩니다. 또한 `author_id`가 `NULL`인 경우 작성자 본인 식별이 불가능하므로 `PENDING` 상태에서의 직접 수정·삭제 권한은 관리자에게만 남고, 모든 활성 유저가 신용 점수에 투표할 수 있습니다.

### 2.2. 상태별 작업 권한 및 조회 규칙 매트릭스

| 작업 | 유저 데이터 (`status = 'PENDING'`) | 공인 데이터 (`status = 'APPROVED'`) | 구현 근거 및 예외 사항 |
| :--- | :--- | :--- | :--- |
| **상세/목록 조회 (`GET`)** | 누구나 조회 가능 (UI에 `승인 대기` 배지 표시) | 누구나 조회 가능 | `EntityStatusBadge`는 `status !== 'APPROVED'`일 때만 표시 |
| **자동완성 우선 정렬** | 후순위 정렬 (`1`) | **우선 정렬 (`0`)** | `ListArtists`, `SearchVenues`의 `ORDER BY CASE WHEN status = 'APPROVED' THEN 0 ELSE 1 END, official_name ASC` (`REJECTED` 제외) |
| **직접 수정 (`PUT`)** | **작성자 본인 또는 관리자** | **관리자만 가능** (`403 Forbidden`) | 일반 유저가 공인 데이터를 수정하려면 `POST /modification-requests` 사용 |
| **직접 삭제 (`DELETE`)** | **작성자 본인 또는 관리자** | **관리자만 가능** (`403 Forbidden`) | 아티스트(`CheckArtistInEvent`)·공연장(`CheckVenueInEvent`)이 이벤트에서 참조 중이면 **`409 Conflict` (`ErrEntityInUse`)** 반환 |
| **관리자 즉시 승격 (`POST .../approve`)** | 관리자 전용 (`APPROVED` 전환 + `high/low_credit_since = NULL` 초기화) | - (`ADMIN`만 `403` 없이 통과) | `ApproveEvent`, `ApproveArtist`, `ApproveVenue` |
| **신용 점수 투표 (`PUT .../credit`)** | 작성자 제외 모든 활성 유저 | 작성자 제외 모든 활성 유저 | `APPROVED` 상태는 점수가 낮아져도 `low_credit_since`가 기록되지 않아 자동 삭제 대상에서 제외 |
| **수정 요청 등록 (`POST /modification-requests`)** | **불가** (`400 Bad Request`, `ErrEntityNotOfficial`) | **모든 활성 유저 가능** | `APPROVED` 상태 엔티티에 대해서만 허용 |

> [!IMPORTANT]
> 정지된 계정(`users.is_banned = true`)은 `CreditService.ensureActiveUser()` 및 각 도메인 서비스의 `IsBanned` 검증에 의해 등록, 수정, 삭제, 신용 투표, 수정 요청 등록, 신뢰 투표, 관리자 승인/반영이 모두 `403 Forbidden`으로 차단됩니다.

---

## 3. ⭐ 엔티티 신용 점수 시스템 (`Credit Score System`)

### 3.1. 상태 전이 및 생명주기

```mermaid
stateDiagram-v2
    [*] --> PENDING: "일반 유저(USER) 등록"
    [*] --> APPROVED: "관리자(ADMIN) 등록"

    state PENDING {
        [*] --> Neutral: "high_credit_since = NULL<br/>low_credit_since = NULL"
        Neutral --> HighSustained: "credit_count >= 5 AND credit_score >= +5<br/>high_credit_since = COALESCE(high_credit_since, NOW())"
        HighSustained --> Neutral: "점수/표수 미달 시<br/>high_credit_since = NULL 초기화"
        Neutral --> LowSustained: "credit_count >= 5 AND credit_score <= -5<br/>low_credit_since = COALESCE(low_credit_since, NOW())"
        LowSustained --> Neutral: "점수/표수 변동 시<br/>low_credit_since = NULL 초기화"
    }

    PENDING --> APPROVED: "관리자 즉시 승인 (POST .../approve)<br/>OR high_credit_since <= NOW() - 24h"
    PENDING --> DELETED: "low_credit_since <= NOW() - 24h<br/>(레코드 물리 삭제)"
    APPROVED --> APPROVED: "수정 요청(trust_score >= +5, 24h 유지) 반영<br/>(낮은 신용 점수로 자동 삭제되지 않음)"
```

### 3.2. 판정 임계 상수 (`backend/internal/service/credit_service.go`)

| 상수명 | 값 | 설명 |
| :--- | :---: | :--- |
| `MinCreditVotes` | `5` | 승격·삭제 지속 타이머가 작동하기 위한 최소 누적 투표 수 (`credit_count`) |
| `PromoteScoreThreshold` | `+5` | 자동 승격 타이머(`high_credit_since`) 진입 기준 순점수 (`credit_score >= 5`) |
| `DeleteScoreThreshold` | `-5` | 자동 삭제 타이머(`low_credit_since`) 진입 기준 순점수 (`credit_score <= -5`) |
| `SustainedCreditDuration` | `24 * time.Hour` | 승격 또는 삭제가 확정되기까지 점수가 유지되어야 하는 최소 시간 |

### 3.3. 1인 1표 투표 처리 및 지속 타이머 재계산 흐름

```mermaid
sequenceDiagram
    actor User as "인증된 활성 유저"
    participant Handler as "credit_handler.go<br/>(PUT /{entity}/{id}/credit)"
    participant Service as "CreditService<br/>(VoteEntityCredit)"
    participant Repo as "credit.sql.go<br/>(PostgreSQL Tx)"

    User->>Handler: "PUT /events/{id}/credit { score: +1 | -1 | 0 }"
    Handler->>Service: "VoteEntityCredit(ctx, entityType, entityID, userID, score)"
    Service->>Service: "score 검증 (-1, 0, 1 외 400)<br/>ensureActiveUser(userID) (정지 시 403)"
    Service->>Repo: "대상 엔티티 조회 (미존재 시 404)<br/>author_id == userID 체크 (본인 시 403)"
    Service->>Service: "MaybeProcessSustainedLifecycle(ctx) (30초 스로틀링)"

    rect rgb(245, 248, 255)
        note right of Service: "단일 DB 트랜잭션 (s.db.BeginTx)"
        alt score == 0 (투표 취소)
            Service->>Repo: "Delete{Entity}CreditVote(user_id, entity_id)"
        else score == 1 or -1
            Service->>Repo: "Upsert{Entity}CreditVote (ON CONFLICT DO UPDATE)"
        end
        Service->>Repo: "Recalculate{Entity}Credit(id, 5, 5, -5)"
        Repo-->>Service: "id, status, credit_score, credit_count, high_credit_since, low_credit_since"
    end

    Service-->>Handler: "CreditVoteResult (myCreditScore 포함)"
    Handler-->>User: "200 OK CreditVoteResponse"
```

#### SQL 레벨 원자적 재계산 (`backend/db/query/credit.sql`)

`RecalculateEventCredit`, `RecalculateArtistCredit`, `RecalculateVenueCredit` 쿼리는 단일 `UPDATE ... RETURNING` 문으로 다음을 원자적으로 처리합니다.

1. **투표 집계 갱신**:
   - `credit_score = COALESCE((SELECT SUM(score)::int FROM ..._credit_votes ...), 0)`
   - `credit_count = COALESCE((SELECT COUNT(*)::int FROM ..._credit_votes ...), 0)`
2. **지속 타이머 시작 / 유지 / 초기화**:
   - `high_credit_since`: `status = 'PENDING'` 이고 `credit_count >= 5` 이며 `credit_score >= +5`이면 `COALESCE(high_credit_since, NOW())`를 적용해 **최초 도달 시각을 보존**합니다. 조건에서 벗어나거나 `APPROVED` 상태면 `NULL`로 초기화합니다.
   - `low_credit_since`: `status = 'PENDING'` 이고 `credit_count >= 5` 이며 `credit_score <= -5`이면 `COALESCE(low_credit_since, NOW())`를 적용하고, 조건에서 벗어나거나 `APPROVED` 상태면 `NULL`로 초기화합니다.
3. **일시적 스파이크 방어**:
   - 24시간이 지나기 전에 단 1표라도 취소·반대 투표가 발생해 `credit_score < 5` 또는 `credit_count < 5`가 되면 `high_credit_since`가 `NULL`로 리셋됩니다. 이후 다시 조건을 달성하면 새로운 `NOW()`부터 24시간을 다시 카운트합니다.
4. **지속 기간 만료 시 배치 전이**:
   - `PromoteSustained{Events|Artists|Venues}`: `WHERE status = 'PENDING' AND high_credit_since IS NOT NULL AND high_credit_since <= NOW() - 24h` 조건을 만족하는 행을 `status = 'APPROVED'`, `high_credit_since = NULL`, `low_credit_since = NULL`로 승격합니다.
   - `DeleteSustainedLowCredit{Events|Artists|Venues}`: `WHERE status = 'PENDING' AND low_credit_since IS NOT NULL AND low_credit_since <= NOW() - 24h` 조건을 만족하는 행을 물리 삭제(`DELETE`)합니다.

> [!WARNING]
> `DeleteSustainedLowCreditArtists` / `DeleteSustainedLowCreditVenues`의 경우, `artists`는 `event_artists(artist_id)`에 `ON DELETE CASCADE`로 연결되어 있고, `venues`는 `events(venue_id)`에 `ON DELETE SET NULL`로 연결되어 있습니다. 반면 사용자가 직접 호출하는 `DELETE /artists/{id}` 및 `DELETE /venues/{id}`는 `CheckArtistInEvent` / `CheckVenueInEvent` 검사로 이벤트 참조 시 `409 Conflict`를 반환해 실수로 인한 연결 해제를 방지합니다.

---

## 4. ✏️ 공인 데이터 수정 요청 및 신뢰 점수 시스템 (`Modification Requests & Trust Score`)

공인(`APPROVED`) 데이터는 일반 유저가 `PUT`으로 직접 덮어쓸 수 없으므로, **수정 요청(`modification_requests`)**을 통해 변경 제안을 등록하고 커뮤니티 투표로 반영 여부를 결정합니다.

### 4.1. 수정 요청 생명주기 및 판정 상수

```mermaid
flowchart TD
    Start(["APPROVED 엔티티에 대한 수정 제안"]) --> Create["POST /modification-requests<br/>status = 'PENDING', proposed_data(JSONB), reason"]
    Create --> Vote["커뮤니티 신뢰 투표<br/>PUT /modification-requests/{requestId}/trust<br/>(+1 / -1 / 0 취소, 작성자 본인 제외)"]
    Create --> AdminApply["관리자 즉시 반영<br/>POST /modification-requests/{requestId}/apply"]
    Create --> ManualDelete["직접 삭제<br/>DELETE /modification-requests/{requestId}<br/>(PENDING 작성자 본인 또는 관리자)"]

    Vote --> CheckHigh{"trust_count >= 5 AND<br/>trust_score >= +5?"}
    CheckHigh -- "예" --> SetHigh["high_trust_since = COALESCE(high_trust_since, NOW())"]
    CheckHigh -- "아니오" --> ResetHigh["high_trust_since = NULL"]

    Vote --> CheckLow{"trust_count >= 5 AND<br/>trust_score <= -5?"}
    CheckLow -- "예" --> SetLow["low_trust_since = COALESCE(low_trust_since, NOW())"]
    CheckLow -- "아니오" --> ResetLow["low_trust_since = NULL"]

    SetHigh --> Wait24H["high_trust_since 24시간 유지<br/>(MaybeProcessSustainedLifecycle)"]
    Wait24H --> TxApply["단일 DB 트랜잭션:<br/>1. 대상 엔티티 업데이트<br/>2. status = 'APPLIED', resolved_at = NOW()"]
    AdminApply --> TxApply

    SetLow --> Wait24L["low_trust_since 24시간 유지<br/>(MaybeProcessSustainedLifecycle)"]
    Wait24L --> AutoDelete["수정 요청 자동 삭제<br/>(DeleteSustainedLowTrustModificationRequests)"]
```

| 상수명 | 값 | 설명 |
| :--- | :---: | :--- |
| `MinTrustVotes` | `5` | 신뢰 점수 타이머(`high_trust_since`, `low_trust_since`) 진입 최소 투표 수 |
| `ApplyTrustThreshold` | `+5` | 자동 반영(`APPLIED`) 타이머 진입 기준 순점수 (`trust_score >= 5`) |
| `RejectTrustThreshold` | `-5` | 자동 기각(삭제) 타이머 진입 기준 순점수 (`trust_score <= -5`) |
| `SustainedTrustDuration` | `24 * time.Hour` | 수정 요청 반영 또는 삭제가 확정되기까지 점수가 유지되어야 하는 최소 시간 |

### 4.2. 주요 규칙 및 권한 검증

1. **등록 (`CreateModificationRequest`)**:
   - 정지 유저(`is_banned = true`) 차단 (`403 Forbidden`).
   - `proposedData`가 비어 있으면 거부 (`400 Bad Request`, `ErrEmptyModification`).
   - 대상 엔티티(`EVENT` / `ARTIST` / `VENUE`)의 `status === 'APPROVED'`인지 검증하며, `PENDING` 등 비공인 상태면 `400 Bad Request` (`ErrEntityNotOfficial`)를 반환합니다.
2. **신뢰 점수 투표 (`VoteModificationRequestTrust`)**:
   - `score`는 `-1`, `0`, `1` 중 하나여야 합니다 (`400 Bad Request`, `ErrInvalidCreditScore`).
   - 요청의 `status !== 'PENDING'` (이미 `APPLIED`)이면 `400 Bad Request` (`ErrModificationAlreadyResolved`).
   - 요청 작성자 본인은 투표할 수 없습니다 (`403 Forbidden`, `ErrSelfVoteNotAllowed`).
   - 단일 DB 트랜잭션 내에서 `UpsertModificationRequestVote` 또는 `DeleteModificationRequestVote` 실행 후 `RecalculateModificationRequestTrust`로 점수와 지속 타이머를 갱신합니다.
3. **삭제 (`DeleteModificationRequest`)**:
   - `ADMIN`은 상태와 무관하게 삭제 가능.
   - 일반 유저는 `req.Status == "PENDING"`이고 `req.AuthorID == userID`일 때만 삭제 가능 (`403 Forbidden`).
4. **즉시 반영 (`ApplyModificationRequestByAdmin`)**:
   - `ADMIN` 전용(`403 Forbidden`). 이미 `APPLIED` 상태면 `400 Bad Request`.

### 4.3. 엔티티별 `proposedData` (`JSONB`) 반영 매핑 규칙

`CreditService.applyModificationRequest(ctx, req)`는 단일 DB 트랜잭션 안에서 아래 함수들을 호출해 부분 필드(`COALESCE` / `sqlc.narg`)만 선택적으로 갱신한 뒤 `MarkModificationRequestApplied`로 `status = 'APPLIED'`, `high_trust_since = NULL`, `low_trust_since = NULL`, `resolved_at = NOW()`를 기록합니다.

| 엔티티 타입 | 백엔드 적용 함수 | 허용 `proposedData` 키 | 타입·검증 및 반영 동작 (`credit_service.go`) |
| :--- | :--- | :--- | :--- |
| **`EVENT`** | `applyEventModification` | `title` | 공백 제외 후 빈 문자열이 아니면 갱신 |
| | | `venueId` | 유효한 non-nil UUID 문자열이면 `venue_id` 변경 |
| | | `openingTime` | `""` 전달 시 `ClearOpeningTime = true` (`opening_time = NULL`), RFC3339 문자열이면 **분 단위 절삭(`Truncate(time.Minute)`)** 후 갱신 |
| | | `startTime` | 비어 있지 않은 RFC3339 문자열이면 **분 단위 절삭** 후 갱신 |
| | | `endTime` | 비어 있지 않은 RFC3339 문자열이면 **분 단위 절삭** 후 갱신 |
| | | `relatedLinks` | 문자열 배열(`[]interface{}`)에서 공백 제거 후 비어 있지 않은 항목으로 교체 |
| | | `artistIds` | 키 존재 시 `ClearArtistsFromEvent` 후 유효한 UUID들을 `AddArtistToEvent`로 재연결 |
| **`ARTIST`** | `applyArtistModification` | `officialName` | 공백 제외 후 빈 문자열이 아니면 갱신 |
| | | `hiragana` | 문자열(빈 문자열 포함 트리밍) 전달 시 갱신 |
| | | `disambiguation` | 문자열(빈 문자열 포함 트리밍) 전달 시 갱신 |
| | | `gender` | `"MALE"` 또는 `"FEMALE"`일 때만 갱신 |
| **`VENUE`** | `applyVenueModification` | `officialName` | 공백 제외 후 빈 문자열이 아니면 갱신 |
| | | `address` | 문자열(트리밍) 전달 시 갱신 |
| | | `latitude` | `float64` 전달 시 갱신 |
| | | `longitude` | `float64` 전달 시 갱신 |
| | | `capacity` | `float64 > 0`일 때 `int32`로 변환해 갱신 |
| | | `relatedLinks` | 문자열 배열(`[]interface{}`)에서 공백 제거 후 비어 있지 않은 항목으로 교체 |

> [!NOTE]
> 프론트엔드 `ModificationRequestsSection.tsx` 폼에서는 현재 UI 상 자주 수정되는 핵심 텍스트/수치 필드(`EVENT`: `title`, `ARTIST`: `officialName`, `hiragana`, `disambiguation`, `VENUE`: `officialName`, `address`, `capacity`)를 우선 제공하고 있으며, 백엔드 API(`proposedData` JSONB)는 위 표의 모든 필드(`venueId`, `openingTime`, `startTime`, `endTime`, `relatedLinks`, `artistIds`, `gender`, `latitude`, `longitude`)를 수용하도록 확장 설계되어 있습니다.

---

## 5. ⚡ 서버리스(AWS Lambda) 대응 지연 평가 (Lazy Evaluation)

Eventer Map 백엔드는 로컬 `net/http` 서버뿐 아니라 요청 단위로 실행·동결되는 **AWS Lambda** 환경에서 동작하므로, 상시 실행되는 백그라운드 고루틴이나 외부 크론 스케줄러 없이 API 요청 시점에 상태 전이를 평가합니다.

### 5.1. 30초 스로틀링 & CAS 동시성 제어 (`MaybeProcessSustainedLifecycle`)

```mermaid
flowchart LR
    Call(["조회/투표 API 진입"]) --> CheckNil{"s == nil or<br/>s.repo == nil?"}
    CheckNil -- "Yes" --> ReturnEarly["즉시 반환"]
    CheckNil -- "No" --> Load["prev = lastLifecycleRun.Load()<br/>now = time.Now().UnixNano()"]
    Load --> Interval{"now - prev < 30s<br/>(lifecycleCheckInterval)?"}
    Interval -- "Yes (스로틀 적중)" --> ReturnEarly
    Interval -- "No" --> CAS{"lastLifecycleRun.CompareAndSwap<br/>(prev, now) 성공?"}
    CAS -- "No (다른 고루틴이 선점)" --> ReturnEarly
    CAS -- "Yes (유일 실행권 획득)" --> Run["ProcessSustainedLifecycle(ctx)<br/>8단계 승격·반영·삭제 배치 실행"]
```

- `lastLifecycleRun`은 `atomic.Int64`로 관리되며, `lifecycleCheckInterval = 30 * time.Second` 간격으로 **단 하나의 요청만 `CompareAndSwap`을 통과**해 배치 처리를 수행하므로 동시 요청 폭주 시에도 DB 부하를 방지합니다.
- `ProcessSustainedLifecycle(ctx)`는 다음 8개 작업을 순차 실행합니다 (`creditCutoff = NOW().UTC() - 24h`, `trustCutoff = NOW().UTC() - 24h`):
  1. `PromoteSustainedEvents(creditCutoff)`
  2. `DeleteSustainedLowCreditEvents(creditCutoff)`
  3. `PromoteSustainedArtists(creditCutoff)`
  4. `DeleteSustainedLowCreditArtists(creditCutoff)`
  5. `PromoteSustainedVenues(creditCutoff)`
  6. `DeleteSustainedLowCreditVenues(creditCutoff)`
  7. `ListSustainedHighTrustModificationRequests(trustCutoff)` 조회 후 각 요청에 `applyModificationRequest(ctx, req)` 실행
  8. `DeleteSustainedLowTrustModificationRequests(trustCutoff)`

### 5.2. 지연 평가 호출 진입점 (총 7개 경로)

| 계층 | 위치 | 트리거 시점 |
| :--- | :--- | :--- |
| **Handler** | `event_handler.go` ➔ `GetEventsEventId` | `GET /events/{eventId}` 이벤트 상세 조회 시 |
| **Handler** | `artist_handler.go` ➔ `GetArtists` | `GET /artists` 아티스트 목록/자동완성 조회 시 |
| **Handler** | `artist_handler.go` ➔ `GetArtistsArtistId` | `GET /artists/{artistId}` 아티스트 상세 조회 시 |
| **Handler** | `venue_handler.go` ➔ `GetVenuesVenueId` | `GET /venues/{venueId}` 공연장 상세 조회 시 |
| **Service** | `credit_service.go` ➔ `VoteEntityCredit` | `PUT /{events|artists|venues}/{id}/credit` 신용 투표 전 |
| **Service** | `credit_service.go` ➔ `ListModificationRequests` | `GET /modification-requests` 수정 요청 목록 조회 전 |
| **Service** | `credit_service.go` ➔ `VoteModificationRequestTrust` | `PUT /modification-requests/{requestId}/trust` 신뢰 투표 전 |

---

## 6. 💾 DB 스키마 · 인덱스 및 API 명세 요약

### 6.1. 데이터베이스 구조 (`000021_add_credit_scores_and_modification_requests`)

1. **엔티티 테이블 확장 컬럼 (`events`, `artists`, `venues`)**:
   - `credit_score INTEGER NOT NULL DEFAULT 0`
   - `credit_count INTEGER NOT NULL DEFAULT 0`
   - `high_credit_since TIMESTAMPTZ`
   - `low_credit_since TIMESTAMPTZ`
   - **부분 인덱스(Partial Index)** — `PENDING` 행만 인덱싱하여 24시간 만료 스캔 비용 최소화:
     - `idx_events_pending_credit_lifecycle ON events (high_credit_since, low_credit_since) WHERE status = 'PENDING'`
     - `idx_artists_pending_credit_lifecycle ON artists (high_credit_since, low_credit_since) WHERE status = 'PENDING'`
     - `idx_venues_pending_credit_lifecycle ON venues (high_credit_since, low_credit_since) WHERE status = 'PENDING'`
2. **신용 투표 테이블 (3개)**:
   - `event_credit_votes (user_id, event_id, score CHECK IN (1, -1))` — `PRIMARY KEY (user_id, event_id)`, 둘 다 `ON DELETE CASCADE`
   - `artist_credit_votes (user_id, artist_id, score CHECK IN (1, -1))` — `PRIMARY KEY (user_id, artist_id)`, 둘 다 `ON DELETE CASCADE`
   - `venue_credit_votes (user_id, venue_id, score CHECK IN (1, -1))` — `PRIMARY KEY (user_id, venue_id)`, 둘 다 `ON DELETE CASCADE`
3. **수정 요청 및 신뢰 투표 테이블 (2개)**:
   - `modification_requests`: `entity_type IN ('EVENT', 'ARTIST', 'VENUE')`, `entity_id`, `author_id REFERENCES users(id) ON DELETE SET NULL`, `proposed_data JSONB`, `reason TEXT`, `status IN ('PENDING', 'APPLIED')`, `trust_score`, `trust_count`, `high_trust_since`, `low_trust_since`, `resolved_at`
   - 인덱스: `idx_mod_requests_entity (entity_type, entity_id, status, created_at DESC)`, `idx_mod_requests_pending_trust (high_trust_since, low_trust_since) WHERE status = 'PENDING'`
   - `modification_request_votes (user_id, request_id, score CHECK IN (1, -1))` — `PRIMARY KEY (user_id, request_id)`, 둘 다 `ON DELETE CASCADE`

### 6.2. 관련 API 엔드포인트 및 상태 코드 (`backend/api/openapi.yaml`)

| Method & Path | `operationId` | 인증/권한 | 주요 상태 코드 및 의미 |
| :--- | :--- | :---: | :--- |
| `PUT /events/{eventId}/credit` | `putEventsEventIdCredit` | 🟢 활성 유저 | `200` (`CreditVoteResponse`), `400` (잘못된 점수), `403` (본인 투표/정지 계정), `404` |
| `PUT /artists/{artistId}/credit` | `putArtistsArtistIdCredit` | 🟢 활성 유저 | `200` (`CreditVoteResponse`), `400`, `403`, `404` |
| `PUT /venues/{venueId}/credit` | `putVenuesVenueIdCredit` | 🟢 활성 유저 | `200` (`CreditVoteResponse`), `400`, `403`, `404` |
| `POST /events/{eventId}/approve` | `postEventsEventIdApprove` | 🟢 `ADMIN` | `200` (`Event`), `403`, `404` |
| `POST /artists/{artistId}/approve` | `postArtistsArtistIdApprove` | 🟢 `ADMIN` | `200` (`Artist`), `403`, `404` |
| `POST /venues/{venueId}/approve` | `postVenuesVenueIdApprove` | 🟢 `ADMIN` | `200` (`Venue`), `403`, `404` |
| `GET /modification-requests` | `listModificationRequests` | ⚪️ (선택) | `200` (`ModificationRequestListResponse`, 로그인 시 `myTrustScore` 포함), `400` |
| `POST /modification-requests` | `createModificationRequest` | 🟢 활성 유저 | `201` (`ModificationRequest`), `400` (비공인 엔티티/빈 변경), `403`, `404` |
| `DELETE /modification-requests/{requestId}` | `deleteModificationRequest` | 🟢 작성자(`PENDING`) / `ADMIN` | `204`, `403`, `404` |
| `PUT /modification-requests/{requestId}/trust` | `voteModificationRequestTrust` | 🟢 활성 유저 | `200` (`ModificationRequest`), `400` (잘못된 점수/이미 반영됨), `403` (본인 투표/정지), `404` |
| `POST /modification-requests/{requestId}/apply` | `applyModificationRequest` | 🟢 `ADMIN` | `200` (`ModificationRequest`), `400` (이미 반영됨), `403`, `404` |

> [!TIP]
> **상세 조회 시 개인 투표 상태 (`myCreditScore`) 포함**:
> `GET /events/{eventId}`, `GET /artists/{artistId}`, `GET /venues/{venueId}`는 비로그인 유저에게도 열려 있으나, JWT 인증 컨텍스트(`middleware.UserIDKey`)가 존재하면 `CreditService.GetUserEntityCreditVote`를 호출해 응답 객체의 `myCreditScore` (`-1`, `0`, `1`)를 함께 채워줍니다.

---

## 7. 🎨 프론트엔드 UI/UX 및 캐시 아키텍처 (`frontend/`)

### 7.1. UI 컴포넌트 배치 및 동작

1. **상태 배지 (`EntityInfoCard.tsx` ➔ `EntityStatusBadge`)**:
   - `ArtistInfoCard` 및 `VenueInfoCard` 헤더에 엔티티의 `status !== 'APPROVED'`일 때 상태 배지(`PENDING` = `'승인 대기'` 등)를 렌더링합니다.
2. **엔티티 신용 점수 투표 (`components/common/CreditVoteSection.tsx`)**:
   - **적용 위치**: `EventDetailPane.tsx`, `ArtistInfoCard`, `VenueInfoCard` 하단.
   - **표시 요소**: 순신용 점수 배지(`+N` 녹색, `-N` 적색, `0` 회색), 총 투표 수(`{{count}}표`), `+1` / `-1` 토글 버튼.
   - **토글 및 취소 로직**: 이미 선택한 점수(`myCreditScore === targetScore`)를 다시 클릭하면 `score: 0`을 전송해 투표를 취소합니다.
   - **작성자 가드**: `user?.id === authorId`이면 버튼을 `disabled` 처리하고 툴팁·안내 토스트로 본인 투표를 방지합니다.
   - **24시간 예고 배너**: `status === 'PENDING'` 상태에서 `highCreditSince`가 존재하면 승격 예고 배너(`credit.promotePending`), `lowCreditSince`가 존재하면 삭제 예고 배너(`credit.deletePending`)를 표시합니다.
3. **공인 데이터 수정 요청 (`components/common/ModificationRequestsSection.tsx`)**:
   - **노출 조건**: 대상 엔티티의 `status === 'APPROVED'`일 때만 `EventDetailPane.tsx`, `ArtistInfoCard`, `VenueInfoCard`에 렌더링됩니다.
   - **Diff 기반 제출**: `initialValues`와 폼 입력값을 비교해 실제로 변경된 필드만 `proposedData` 객체에 담아 전송하며, 변경된 필드가 없으면 `'변경된 내용이 없습니다.'` 토스트로 차단합니다.
   - **목록 및 액션**: `status: 'PENDING'` 목록을 조회해 제안자 닉네임(탈퇴 시 `'익명'`), 사유(`reason`), 제안 필드 목록(`proposedData`), 신뢰 점수(`trustScore`, `trustCount`)를 표시합니다.
   - **권한별 제어**:
     - 신뢰 투표(`+1`/`-1`, 동일 버튼 재클릭 시 `0` 취소)는 요청 작성자(`req.authorId === user.id`) 본인은 비활성화.
     - 삭제(`Trash2`)는 작성자 본인 또는 `ADMIN`에게만 노출.
     - 즉시 반영(`Check`)은 `user?.role === 'ADMIN'`에게만 노출.

### 7.2. TanStack Query 캐시 무효화 및 다국어 키

- **투표 및 수정 요청 변경 후 캐시 무효화**:
  - `CreditVoteSection` / `ModificationRequestsSection` 모두 성공(`onSuccess`) 시 대상 엔티티의 상세 쿼리 키(`getGetEventsEventIdQueryKey`, `getGetArtistsArtistIdQueryKey`, `getGetVenuesVenueIdQueryKey`)와 목록 쿼리 키(`getGetEventsQueryKey`, `getGetArtistsQueryKey`, `['/venues']`)를 함께 무효화합니다. (`ModificationRequestsSection`은 추가로 `getListModificationRequestsQueryKey({ entityType, entityId, status: 'PENDING' })`를 무효화)
- **다국어 지원 (`frontend/src/i18n/locales/{ko,en,ja,zh}.json`)**:
  - `credit.*`: 제목, 투표 수, 실패 메시지, 본인 투표 금지 안내, 24시간 승격/삭제 예고 문구
  - `modRequest.*`: 제목, 요청 등록/취소, 사유 입력, 변경 없음/등록/삭제/반영 토스트, 관리자 즉시 반영, 신뢰 점수 라벨
  - `entityInfo.status.*`: `PENDING`, `APPROVED`, `REJECTED` 상태명

---

## 8. 🧩 구현 파일 맵 (Code Map)

| 영역 | 파일 경로 | 핵심 역할 |
| :--- | :--- | :--- |
| **DB 마이그레이션** | `backend/db/migration/000021_add_credit_scores_and_modification_requests.{up,down}.sql` | 신용 점수·타이머 컬럼, 부분 인덱스 3종, 투표/수정 요청 테이블 5종 |
| **SQL 쿼리** | `backend/db/query/credit.sql`, `backend/db/query/modification_request.sql` | 1인 1표 Upsert/Delete, 원자적 점수·타이머 재계산, 24h 만료 승격/삭제/반영 |
| **Repository (`sqlc`)** | `backend/internal/repository/credit.sql.go`, `modification_request.sql.go`, `models.go` | 타입 안전 DB 접근 코드 (자동 생성) |
| **OpenAPI 명세** | `backend/api/openapi.yaml` | Credit / ModificationRequests 스키마 및 엔드포인트 정의 |
| **Service** | `backend/internal/service/credit_service.go` (`credit_service_test.go`) | 임계 상수, 투표/수정 요청/관리자 반영 비즈니스 로직, 30초 스로틀링 지연 평가 |
| | `backend/internal/service/{event,artist,venue}_service.go` | 초기 `PENDING`/`APPROVED` 분기, 직접 수정·삭제 권한 및 `Approve*` |
| **Handler** | `backend/internal/handler/credit_handler.go` | HTTP 요청 바인딩, 에러 코드 매핑(`400`/`403`/`404`) |
| | `backend/internal/handler/{event,artist,venue}_handler.go` | 조회 시 지연 평가 트리거 및 `myCreditScore` 주입, `Approve*` 핸들러 |
| **Frontend UI** | `frontend/src/components/common/CreditVoteSection.tsx` | 신용 점수 배지, `+1`/`-1`/`0` 토글, 24h 상태 예고 배너 |
| | `frontend/src/components/common/ModificationRequestsSection.tsx` | 공인 데이터 수정 제안 폼, 신뢰 점수 투표, 관리자 즉시 반영/삭제 |
| | `frontend/src/components/events/EventDetailPane.tsx`, `EntityInfoCard.tsx` | 이벤트/출연자/공연장 상세 뷰 연동 및 상태 배지 표시 |
| **다국어 (i18n)** | `frontend/src/i18n/locales/{ko,en,ja,zh}.json` | `credit`, `modRequest`, `entityInfo.status`, `artist`, `venue` 섹션 |
