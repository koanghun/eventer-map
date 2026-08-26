# 📖 Eventer Map - API 상세 설계서

본 문서는 Eventer Map 백엔드 서버의 전체 API 스펙을 도메인별로 정리한 명세서입니다. 
클라이언트(웹/앱)와의 연동 시 참고할 수 있도록 구성되었습니다.

---

## 1. 🔐 인증 & 인가 (Auth & Users)

모든 데이터 변경(생성, 수정, 삭제) 및 유저 특정 액션(평점, 참석) API는 인증된 사용자만 접근할 수 있습니다. JWT 기반의 접근을 통제하며 Bearer Token 방식을 사용합니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/signup` | **자체 회원가입**: 이메일, 비밀번호, 닉네임으로 새로운 계정을 생성합니다. | ❌ |
| `POST` | `/auth/login` | **자체 로그인**: 이메일과 비밀번호로 로그인하고 JWT(Access, Refresh Token)를 발급받습니다. | ❌ |
| `POST` | `/auth/google` | **구글 로그인/가입**: OAuth2 Authorization Code를 전달받아 로그인 또는 가입을 처리합니다. | ❌ |
| `POST` | `/auth/refresh` | **토큰 갱신**: 만료된 Access Token을 Refresh Token을 통해 재발급 받습니다. | ❌ |
| `POST` | `/auth/logout` | **로그아웃**: 서버 측에서 Refresh Token을 무효화(Redis/DB) 시킵니다. | 🟢 |
| `POST` | `/users/me/link-google`| **소셜 계정 연동**: 기존 자체 로그인 사용자의 계정에 구글 계정을 연동합니다. | 🟢 |

---

## 2. 🎤 아티스트 (Artists)

아티스트의 목록과 상세 정보, 그리고 위키 방식의 정보 업데이트를 관리합니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/artists` | **아티스트 목록 조회**: 초성, 영문, 히라가나 기반 검색(`query`), 상태(`status`), 커서 기반 페이지네이션을 지원합니다. | ❌ |
| `POST` | `/artists` | **아티스트 등록 제안**: 누구나 폼 데이터(`multipart/form-data`) 형식으로 프로필 이미지와 함께 새 아티스트를 등록합니다. | 🟢 |
| `GET` | `/artists/{artistId}`| **아티스트 단건 상세 조회**: 특정 아티스트의 정보 및 종합 평점을 조회합니다. | ❌ |
| `PUT` | `/artists/{artistId}`| **아티스트 정보 수정 제안**: 아티스트의 프로필 정보 수정 요청을 보냅니다. (위키 히스토리에 기록) | 🟢 |
| `DELETE`| `/artists/{artistId}`| **아티스트 삭제 제안**: 부적절하거나 중복된 아티스트 삭제를 요청합니다. | 🟢 |
| `POST` | `/artists/{artistId}/approve`| **아티스트 검수 승인**: 관리자(Admin) 권한으로 등록/수정 요청을 최종 승인(PENDING -> ACTIVE)합니다. | 🟢 (Admin) |

---

## 3. 🏟️ 공연장 (Venues)

지도 기반 서비스의 핵심인 공연장 좌표 반환 및 정보 열람을 담당합니다. 지도 이동 시 실시간으로 바운딩 박스(Bounding Box) 쿼리가 빈번히 발생합니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/venues` | **공연장 목록 조회 (지도 기반)**: 화면에 보이는 바운딩 박스(`minLat`, `maxLat`, `minLng`, `maxLng`) 안의 공연장만 검색합니다. | ❌ |
| `POST` | `/venues` | **공연장 등록 제안**: 주소, 위경도 좌표, 수용 인원 정보와 함께 새로운 공연장을 등록합니다. | 🟢 |
| `GET` | `/venues/{venueId}`| **공연장 단건 상세 조회**: 특정 공연장의 위치 상세 및 평점을 조회합니다. | ❌ |
| `PUT` | `/venues/{venueId}`| **공연장 정보 수정 제안**: 잘못된 좌표나 바뀐 이름을 수정 요청합니다. | 🟢 |
| `DELETE`| `/venues/{venueId}`| **공연장 삭제 제안**: 폐업이나 중복된 공연장의 삭제를 요청합니다. | 🟢 |
| `POST` | `/venues/{venueId}/approve`| **공연장 검수 승인**: 관리자(Admin) 권한으로 등록/수정 요청을 최종 승인합니다. | 🟢 (Admin) |

---

## 4. 🎫 이벤트 (Events & Wiki)

사용자들이 아티스트와 공연장을 엮어 이벤트를 생성하고, 이벤트의 과거 수정 이력(위키)을 추적하며, 평점과 쓰레드(댓글)를 남기는 시스템입니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/events` | **이벤트 목록 조회**: 특정 `artistId`, `venueId`, 또는 날짜 범위(`timeRange`)로 이벤트를 필터링하여 조회합니다. | ❌ |
| `POST` | `/events` | **이벤트 등록 (위키 방식)**: 포스터 이미지 파일과 함께 새로운 이벤트를 작성합니다. 이벤트 생성 즉시 History가 기록됩니다. | 🟢 |
| `GET` | `/events/{eventId}`| **이벤트 단건 상세 조회**: 이벤트 기본 정보, 참석자 통계, 평점 통계를 반환합니다. | ❌ |
| `PUT` | `/events/{eventId}`| **이벤트 정보 수정 (위키 방식)**: 시작 시간 변경이나 참가 아티스트 목록 등을 수정합니다. 기존 정보는 History에 백업됩니다. | 🟢 |
| `POST` | `/events/{eventId}/delete-request`| **이벤트 삭제 요청**: 취소되거나 잘못된 이벤트의 삭제를 요청합니다. | 🟢 |
| `GET` | `/events/{eventId}/history`| **이벤트 수정 이력 조회 (위키)**: 해당 이벤트가 어떤 과정을 거쳐 수정되어 왔는지 버전별로 나열합니다. | ❌ |
| `POST` | `/event-history/{historyId}/report`| **특정 수정 이력 신고 (반달리즘 방지)**: 악의적인 수정(트롤링)을 관리자에게 신고하여 롤백을 요청합니다. | 🟢 |

---

## 5. ⭐️ 상호작용 (Interaction & Social)

사용자가 이벤트에 대해 직접 액션을 취하는 소셜 기능들입니다.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/events/{eventId}/attend`| **이벤트 참석 (토글 방식)**: "나 이 이벤트 갈래!" 버튼입니다. 한 번 더 호출하면 참석이 취소됩니다. | 🟢 |
| `POST` | `/events/{eventId}/rate` | **이벤트 평점 매기기**: 1~5점 사이의 평점을 부여합니다. 내부 트랜잭션을 통해 해당 아티스트와 공연장 평점에도 영향(가중치)을 줄 수 있습니다. | 🟢 |
| `GET` | `/events/{eventId}/threads`| **이벤트 쓰레드(댓글) 조회**: 이벤트에 달린 사람들의 기대평, 리뷰 등의 쓰레드를 조회합니다. | ❌ |
| `POST` | `/events/{eventId}/threads`| **이벤트 쓰레드 작성**: 이벤트에 대한 의견이나 리뷰를 남깁니다. | 🟢 |
| `POST` | `/event-threads/{threadId}/recommend`| **쓰레드 추천(좋아요)**: 유용한 쓰레드나 리뷰에 추천을 누릅니다. | 🟢 |

---

> [!TIP]
> **API 응답 공통 포맷 (Response Format)**
> 백엔드의 모든 오류는 통일된 에러 규격(JSON)을 따릅니다.
> ```json
> {
>   "error": "에러 원인에 대한 상세 메시지 (예: Invalid form data)"
> }
> ```
> 정상 동작 시에는 HTTP 200 OK 와 함께 요청한 도메인 객체가 JSON 형태로 반환됩니다.

> [!IMPORTANT]
> 본 설계서는 `api/openapi.yaml` 에 정의된 스펙을 기반으로 정리된 문서입니다. 클라이언트 개발 시 데이터 타입 및 필드명에 대한 구체적인 명세는 `openapi.yaml` 또는 Swagger UI를 참고하시기 바랍니다.
