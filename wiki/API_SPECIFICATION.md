# 📖 Eventer Map - API 상세 설계서

[⬅️ 홈으로 돌아가기](./Home.md) | [관련 문서: Orval 가이드](./ORVAL_GUIDE.md)

본 문서는 Eventer Map 백엔드 서버(`backend/api/openapi.yaml`)의 전체 API 스펙을 도메인별로 정리한 명세서입니다.
클라이언트(React 프론트엔드)와의 연동 시 참고할 수 있도록 구성되었습니다.

---

## 1. 🔐 인증 & 유저 (Auth & Users)

모든 데이터 변경(생성, 수정, 삭제) 및 유저 특정 액션(평점, 참석, 팔로우) API는 인증된 사용자만 접근할 수 있습니다. JWT 기반의 접근을 통제하며 `Authorization: Bearer <accessToken>` 방식을 사용합니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/signup` | **자체 회원가입**: 이메일, 비밀번호, 닉네임으로 가입 요청 후 인증 코드를 발송합니다. | ❌ |
| `POST` | `/auth/verify-email` | **이메일 인증**: 수신한 6자리 인증 코드를 검증하여 계정을 활성화하고 토큰을 발급합니다. | ❌ |
| `POST` | `/auth/login` | **자체 로그인**: 이메일과 비밀번호로 로그인하고 JWT(Access, Refresh Token)를 발급받습니다. | ❌ |
| `POST` | `/auth/google` | **구글 로그인/가입**: Google `idToken`을 검증하여 로그인 또는 자동 가입을 처리합니다. | ❌ |
| `POST` | `/auth/refresh` | **토큰 갱신**: `HttpOnly` 쿠키의 Refresh Token으로 새 Access Token을 발급받습니다. | ❌ |
| `POST` | `/auth/logout` | **로그아웃**: Refresh Token 쿠키를 만료시킵니다. | 🟢 |
| `GET` | `/users/me` | **내 프로필 조회**: 현재 로그인한 사용자의 프로필 및 권한(`USER`/`ADMIN`)을 조회합니다. | 🟢 |
| `PATCH` | `/users/me` | **프로필 수정**: 표시 이름(닉네임)을 변경합니다. | 🟢 |
| `PUT` | `/users/me/password` | **비밀번호 변경**: 현재 비밀번호 확인 후 새 비밀번호로 변경합니다. | 🟢 |
| `GET` | `/users/me/events` | **내 이벤트 액션 목록 조회**: 체크(`1`)하거나 참가(`2`)한 이벤트 목록을 조회합니다. | 🟢 |
| `POST` | `/users/me/link-google` | **구글 계정 연동**: 로그인된 계정에 Google 계정을 연동합니다. | 🟢 |
| `POST` | `/users/me/unlink-google` | **구글 계정 연동 해제**: 연동된 Google 계정을 해제합니다. | 🟢 |
| `GET` | `/users/me/following` | **내가 팔로우하는 유저 목록 조회** | 🟢 |
| `GET` | `/users/me/followers` | **나를 팔로우하는 유저 목록 조회** | 🟢 |
| `GET` | `/users/me/following/artists` | **내가 팔로우하는 아티스트 목록 조회** | 🟢 |
| `GET` | `/users/me/following-artists/events` | **팔로우 아티스트 이벤트 피드 및 미확인 카운트 조회**: 팔로우한 아티스트들의 이벤트 목록(`events`)과 `last_artist_feed_checked_at` 이후 등록된 미확인 이벤트 수(`unreadCount`)를 반환합니다. | 🟢 |
| `POST` | `/users/me/following-artists/events/read` | **팔로우 아티스트 피드 읽음 처리**: `users.last_artist_feed_checked_at`을 현재 시각(`NOW()`)으로 갱신하여 `unreadCount`를 `0`으로 초기화합니다. | 🟢 |
| `POST` | `/users/{userId}/follow` | **특정 유저 팔로우** | 🟢 |
| `DELETE` | `/users/{userId}/follow` | **특정 유저 언팔로우** | 🟢 |
| `GET` | `/users/me/blocks` | **내가 차단한 유저 목록 조회** | 🟢 |
| `POST` | `/users/{userId}/block` | **특정 유저 차단** | 🟢 |
| `DELETE` | `/users/{userId}/block` | **특정 유저 차단 해제** | 🟢 |

---

## 2. 🎤 아티스트 / 출연자 (Artists)

출연자(아티스트) 자동완성 검색, 신규 등록, 상세 조회 및 팔로우를 관리합니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/artists` | **아티스트 목록/자동완성 조회**: `query`(공식 이름 대소문자 무시 전방 일치, 히라가나 전방 일치), `limit`(기본 15, 최대 50, 자동완성 시 10), `status`, `cursor` 기반 조회를 지원합니다. | ❌ |
| `POST` | `/artists` | **신규 아티스트 등록 (`multipart/form-data`)**: `officialName`(필수), `gender`(`MALE` \| `FEMALE`, 필수), `hiragana`(선택), `disambiguation`(동명이인 구분용 한 줄 식별 설명, 최대 100자, 선택), `profileImage`(최대 5MB, JPG/PNG, 선택)를 받아 등록합니다. (유저 등록 시 `PENDING`, 관리자 등록 시 `APPROVED`) | 🟢 |
| `GET` | `/artists/{artistId}` | **아티스트 단건 상세 조회**: 특정 아티스트의 상세 정보를 조회합니다. | ❌ |
| `PUT` | `/artists/{artistId}` | **아티스트 정보 수정**: 작성자(심사 중일 때) 또는 관리자가 아티스트 정보를 수정합니다. | 🟢 |
| `DELETE` | `/artists/{artistId}` | **아티스트 삭제**: 이벤트에 연결되지 않은 아티스트를 삭제합니다. | 🟢 |
| `POST` | `/artists/{artistId}/approve` | **아티스트 승인**: 관리자(`ADMIN`) 전용 즉시 승인 엔드포인트입니다. | 🟢 (Admin) |
| `POST` | `/artists/{artistId}/follow` | **아티스트 팔로우** | 🟢 |
| `DELETE` | `/artists/{artistId}/follow` | **아티스트 언팔로우** | 🟢 |
| `GET` | `/artists/{artistId}/followers` | **아티스트 팔로워 목록 조회** | ❌ |

### 💡 아티스트 스키마 핵심 포인트 (`Artist` / `ArtistSummary` / `ArtistInput`)
- **성별 (`gender`)**: `MALE`(남성) / `FEMALE`(여성) 2종으로만 분류합니다.
- **동명이인 구분 (`disambiguation`)**: 생년월일/데뷔일 대신 소속 그룹·분야 등 한 줄 식별 설명(`VARCHAR(100)`, 예: `"솔로 가수"`, `"LE SSERAFIM"`, `"성우"`)을 통해 자동완성 드롭다운, 선택 칩, 이벤트 상세 화면에서 동명이인을 명확히 구분합니다.
- **평점 (`rating`, `ratingCount`)**: 참가한 이벤트들의 평균 평점 합계(`rating_sum`)와 평점 부여 이벤트 수(`rating_count`)로 일원화되어 관리됩니다.

---

## 3. 🏟️ 공연장 / 회장 (Venues)

지도 기반 공연장 조회, 저부하 전방 일치 자동완성 검색, 그리고 신규 회장 등록을 담당합니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/venues/search` | **공연장 자동완성 검색**: `query`(공식 이름 대소문자 무시 전방 일치 `LOWER(official_name) LIKE ...`), `limit`(기본 10, 최대 20) 파라미터로 가볍게 `VenueSummary[]`(`id`, `officialName`, `address`, `latitude`, `longitude`, `rating`, `status`)를 반환합니다. `APPROVED` 상태 공연장이 우선 정렬됩니다. | ❌ |
| `GET` | `/venues` | **공연장 목록 조회 (지도 기반)**: 화면 바운딩 박스(`minLat`, `maxLat`, `minLng`, `maxLng`) 내의 공연장을 검색합니다. | ❌ |
| `POST` | `/venues` | **신규 공연장 등록 (`application/json`)**: `officialName`(필수), `latitude`(필수), `longitude`(필수), `address`(선택), `googleMapId`(선택), `capacity`(선택), `relatedLinks`(선택)를 받아 등록합니다. (유저 등록 시 `PENDING`, 관리자 등록 시 `APPROVED`) | 🟢 |
| `GET` | `/venues/{venueId}` | **공연장 단건 상세 조회**: 특정 공연장의 위치 상세 및 평점을 조회합니다. | ❌ |
| `PUT` | `/venues/{venueId}` | **공연장 정보 수정**: 권한(유저/관리자)에 따라 공연장 정보를 수정합니다. | 🟢 |
| `DELETE` | `/venues/{venueId}` | **공연장 삭제**: 공연장을 삭제합니다. | 🟢 |
| `POST` | `/venues/{venueId}/approve` | **공연장 승인**: 관리자(`ADMIN`) 전용 승인 엔드포인트입니다. | 🟢 (Admin) |

---

## 4. 🎫 이벤트 (Events)

공연장과 출연자를 연결하여 이벤트를 생성하고, 지도 바운딩 박스 및 날짜 범위로 조회합니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/events` | **이벤트 목록 조회**: 지도 바운딩 박스(`minLat`, `maxLat`, `minLng`, `maxLng`), 날짜 범위(`startDate`, `endDate`), `artistId`, `venueId`, `limit`으로 필터링하여 참가자 수 순으로 조회합니다. | ❌ |
| `POST` | `/events` | **새 이벤트 등록**: `title`, `venueId`, `startTime`, `endTime`(이상 필수), `openingTime`, `artistIds`, `relatedLinks`를 전달받아 이벤트를 생성합니다. | 🟢 |
| `GET` | `/events/{eventId}` | **이벤트 단건 상세 조회**: 이벤트 기본 정보, 공연장 요약(`VenueSummary`), 출연자 목록(`ArtistSummary[]`), 참가자 수, 평점 통계를 반환합니다. | ❌ |
| `PUT` | `/events/{eventId}` | **이벤트 정보 수정**: 이벤트 정보를 수정하고 공연장/출연자 평점 통계를 재동기화합니다. | 🟢 |
| `POST` | `/events/{eventId}/delete-request` | **이벤트 삭제 요청**: 이벤트 삭제 요청을 접수합니다. | 🟢 |

---

## 5. ⭐️ 상호작용 및 통계 (Interaction, Threads & Stats)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/events/{eventId}/action` | **이벤트 체크/참가 등록**: `status: 1`(체크/북마크) 또는 `status: 2`(참가)를 설정합니다. | 🟢 |
| `DELETE` | `/events/{eventId}/action` | **이벤트 체크/참가 취소**: 설정한 액션을 해제합니다. | 🟢 |
| `POST` | `/events/{eventId}/rate` | **이벤트 평점 매기기**: 1~5점 사이의 평점을 부여합니다. | 🟢 |
| `GET` | `/events/{eventId}/threads` | **이벤트 스레드 목록 조회**: 추천수 순 및 커서 기반 페이지네이션으로 스레드를 조회합니다. 로그인 시 추천 여부(`isRecommended`) 및 본인 작성 여부(`isMine`)가 포함됩니다. | ⚪️ |
| `POST` | `/events/{eventId}/threads` | **이벤트 스레드 작성**: 이벤트에 스레드를 작성합니다 (최대 1,000자). | 🟢 |
| `DELETE` | `/event-threads/{threadId}` | **이벤트 스레드 삭제**: 작성자 본인 또는 관리자가 스레드를 삭제합니다. | 🟢 |
| `PUT` | `/event-threads/{threadId}/recommend` | **스레드 추천**: 유용한 스레드를 추천합니다 (본인 글 제외, 멱등). | 🟢 |
| `DELETE` | `/event-threads/{threadId}/recommend` | **스레드 추천 취소**: 추천을 취소합니다 (멱등). | 🟢 |
| `POST` | `/stats/visit` | **일일 방문 기록 및 카운트 반환** | ❌ |
| `GET` | `/stats/visit` | **오늘의 일일 방문자 수 조회** | ❌ |

### 💡 이벤트 스레드(커뮤니티) 핵심 스펙 및 정책
- **정렬 및 랭킹**: 누적 추천수(`recommendCount`) 내림차순 ➔ 작성 시각(`createdAt`) 최신순 ➔ `id` 내림차순으로 정렬되어 양질의 정보가 자연스럽게 상단에 노출됩니다.
- **커서 기반 페이지네이션**: `nextCursor`는 불투명 Base64 인코딩 문자열(`recommendCount|createdAtNano|id`)로 전달되며, 동점자가 발생해도 누락 없이 일관된 순서를 유지합니다.
- **추천 무결성**: 본인이 작성한 스레드는 추천할 수 없으며(`400 Bad Request`), 추천/취소 요청은 멱등(Idempotent)하게 처리됩니다.
- **탈퇴 유저 및 차단 정책**: 작성자 탈퇴 시 작성 글은 보존되며 `author: null`로 응답합니다. 상호 차단(`user_blocks`) 관계인 유저의 스레드는 조회 목록에서 자동으로 필터링됩니다.

---

> [!TIP]
> **API 응답 공통 에러 포맷**
> ```json
> {
>   "error": "에러 원인에 대한 상세 메시지 (예: officialName is required)"
> }
> ```
