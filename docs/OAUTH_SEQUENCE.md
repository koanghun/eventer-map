# Google OAuth 로그인 시퀀스

이 문서는 Eventer Map 애플리케이션의 Google OAuth 2.0 로그인 프로세스를 설명합니다.

```mermaid
sequenceDiagram
    actor User as 사용자
    participant App as Frontend (React)
    participant Server as Backend (FastAPI)
    participant Google as Google OAuth Server
    participant DB as Database

    %% 1. 로그인 요청
    User->>App: "Google로 로그인" 버튼 클릭
    App->>Server: GET /api/auth/google/login
    Server-->>App: 307 Redirect (Google 로그인 URL)
    
    %% 2. Google 인증
    App->>Google: Google 로그인 페이지로 리다이렉트
    User->>Google: Google 계정으로 로그인 & 승인
    Google-->>User: 인증 코드(Code) 발급
    
    %% 3. 콜백 처리
    User->>App: GET /auth/callback?code=... (리다이렉트)
    App->>App: URL에서 code 추출 (AuthCallback 컴포넌트)
    App->>Server: GET /api/auth/google/callback?code=...
    
    %% 4. 토큰 교환
    activate Server
    Server->>Google: POST /token (code + client_id + secret)
    Google-->>Server: Access Token 반환
    Server->>Google: GET /userinfo (Access Token 사용)
    Google-->>Server: 사용자 프로필 정보 (email, name, picture)
    
    %% 5. 사용자 처리
    Server->>DB: 사용자 조회 (google_id)
    alt 신규 사용자
        Server->>DB: User 생성 및 저장
    else 기존 사용자
        Server->>DB: 프로필 정보 업데이트
    end
    
    %% 6. JWT 발급
    Server->>Server: JWT Access Token 생성 (sub=user.id)
    Server-->>App: 307 Redirect (/auth/callback?token=JWT)
    deactivate Server
    
    %% 7. 로그인 완료
    App->>App: JWT를 localStorage에 저장 ('auth_token')
    App->>App: 홈 화면('/')으로 이동
    
    %% 8. 사용자 정보 로드 (AuthContext)
    App->>Server: GET /api/auth/me (Authorization: Bearer JWT)
    Server->>Server: JWT 검증 (verify_token)
    Server->>DB: 사용자 정보 조회
    DB-->>Server: User 객체
    Server-->>App: 사용자 정보 (JSON)
    App->>User: 로그인 상태 UI 표시 (프로필, 로그아웃 버튼)
```

## 주요 구성 요소

### Frontend
- **LoginButton**: `/api/auth/google/login`으로 리다이렉트 시작
- **AuthCallback**: `/auth/callback` 라우트에서 처리, URL 파라미터의 `token`을 추출하여 저장
- **AuthContext**: `localStorage`에 토큰 관리 및 전역 인증 상태(`user`, `isAuthenticated`) 제공
- **Interceptor**: 모든 API 요청에 자동으로 `Authorization: Bearer <token>` 헤더 추가

### Backend
- **Login Endpoint**: Google OAuth URL 생성 및 리다이렉트
- **Callback Endpoint**: 
  1. `httpx`를 사용하여 Google과 통신 (Code -> Token -> UserInfo)
  2. DB에 사용자 정보 동기화 (Create or Update)
  3. 자체 JWT 발급 (HS256)
- **Token Verification**: `python-jose`를 사용하여 JWT 서명 및 만료 검증
- **Security**: `@require_auth` 데코레이터로 API 보호
