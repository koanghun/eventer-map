# Google OAuth 2.0 설정 가이드

## 1. Google Cloud Console 설정

### 1.1 프로젝트 생성 또는 선택
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택

### 1.2 OAuth 동의 화면 구성
1. 왼쪽 메뉴에서 **API 및 서비스** > **OAuth 동의 화면** 선택
2. **User Type**: External 선택 후 **만들기** 클릭
3. 앱 정보 입력:
   - **앱 이름**: Eventer Map
   - **사용자 지원 이메일**: 본인 이메일
   - **개발자 연락처 정보**: 본인 이메일
4. **저장 후 계속** 클릭
5. 범위(Scopes) 단계에서 **저장 후 계속** 클릭
6. 테스트 사용자 추가 (선택사항)
7. **대시보드로 돌아가기** 클릭

### 1.3 OAuth 2.0 클라이언트 ID 생성
1. 왼쪽 메뉴에서 **API 및 서비스** > **사용자 인증 정보** 선택
2. 상단의 **+ 사용자 인증 정보 만들기** > **OAuth 클라이언트 ID** 클릭
3. 애플리케이션 유형 설정:
   - **애플리케이션 유형**: 웹 애플리케이션
   - **이름**: Eventer Map Web Client

4. **승인된 리디렉션 URI** 추가:
   ```
   개발 환경:
   http://localhost:8000/api/auth/google/callback
   
   프로덕션 환경 (배포 시):
   https://your-domain.com/api/auth/google/callback
   ```

5. **만들기** 클릭
6. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀** 복사

---

## 2. 백엔드 환경변수 설정

### 2.1 `.env` 파일 생성
```bash
cd backend
cp .env.example .env
```

### 2.2 `.env` 파일 편집
```bash
nano .env
```

다음 내용 추가:
```env
# 기존 설정
DATABASE_URL=sqlite:///./data/eventer.db
CORS_ORIGINS=http://localhost:3000,http://localhost
FRONTEND_URL=http://localhost:3000

# Google OAuth 2.0
GOOGLE_CLIENT_ID=발급받은-클라이언트-ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=발급받은-클라이언트-보안비밀
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# JWT 설정
JWT_SECRET_KEY=your-very-secure-random-secret-key-change-this
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

> **중요**: `JWT_SECRET_KEY`는 랜덤한 긴 문자열로 설정하세요. 
> 생성 방법: `openssl rand -hex 32`

---

## 3. 백엔드 환경 및 실행

### 3.1 Docker 환경에서 의존성 설치

**현재 환경**: SSH 컨테이너에서 작업 중이며, 백엔드는 별도 컨테이너에서 실행됩니다.

의존성은 백엔드 컨테이너 빌드/시작 시 자동으로 설치됩니다.

### 3.2 백엔드 컨테이너 재시작

새로운 의존성(`authlib`, `python-jose`, `passlib`)을 설치하려면 백엔드 컨테이너를 재빌드하세요:

```bash
# 호스트 시스템 또는 SSH 컨테이너에서 실행
cd /home/developer/eventer-map

# 백엔드 컨테이너만 재빌드 및 재시작
docker-compose -f docker-compose.dev.yml up -d --build backend
```

또는 전체 스택 재시작:
```bash
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

### 3.3 데이터베이스 테이블 생성

백엔드 컨테이너가 시작되면 `main.py`의 다음 코드로 자동 생성됩니다:
```python
models.Base.metadata.create_all(bind=engine)
```

`users` 테이블이 자동으로 생성됩니다.

### 3.4 백엔드 로그 확인

```bash
# 백엔드 로그 확인
docker logs eventer-map-backend-dev -f

# 또는
docker-compose -f docker-compose.dev.yml logs -f backend
```

서버가 http://localhost:7773 (또는 설정된 BACKEND_PORT)에서 실행됩니다.

---

## 4. 프론트엔드 설정 (이미 완료)

### 4.1 의존성 설치 (완료)
```bash
cd frontend
npm install @react-oauth/google --legacy-peer-deps
```

### 4.2 AuthProvider 통합
App.tsx 업데이트 필요 (다음 단계에서 진행)

---

## 5. 테스트

### 5.1 백엔드 API 확인
브라우저에서 http://localhost:7773/docs (또는 설정된 BACKEND_PORT) 접속하여 API 문서 확인

### 5.2 OAuth 플로우 테스트
1. 프론트엔드 접속: http://localhost:7772 (또는 설정된 FRONTEND_PORT)
2. "Google로 로그인" 버튼 클릭
3. Google 로그인 페이지로 리다이렉트 확인
4. 로그인 후 사용자 프로필 표시 확인

---

## 트러블슈팅

### 문제 1: redirect_uri_mismatch 에러
- Google Cloud Console에서 설정한 리디렉션 URI와 환경변수의 `GOOGLE_REDIRECT_URI`가 정확히 일치하는지 확인
- 프로토콜(http/https), 도메인, 포트, 경로가 모두 일치해야 함

### 문제 2: 401 Unauthorized
- JWT_SECRET_KEY가 설정되어 있는지 확인
- 브라우저 localStorage에서 토큰 확인: `localStorage.getItem('auth_token')`

### 문제 3: CORS 에러
- `.env`의 `CORS_ORIGINS`에 프론트엔드 URL이 포함되어 있는지 확인
