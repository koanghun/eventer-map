# 트러블슈팅 가이드

## Google OAuth 에러: 401 invalid_client

### 증상
```
The OAuth client was not found.
エラー 401: invalid_client
```

### 원인 및 해결 방법

#### 1. Google Cloud Console에서 클라이언트 ID/Secret 확인

[Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서:

1. **올바른 프로젝트 선택** (상단 프로젝트 선택기)
2. **OAuth 2.0 클라이언트 ID** 클릭
3. **클라이언트 ID**와 **클라이언트 보안 비밀번호** 확인
4. `.env` 파일의 값과 **정확히 일치**하는지 확인

#### 2. 클라이언트 ID 형식 확인

올바른 형식:
```
GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 3. 클라이언트가 활성화되어 있는지 확인

- OAuth 2.0 클라이언트가 **삭제되거나 비활성화**되지 않았는지 확인
- 필요시 새 클라이언트 생성

#### 4. 승인된 리디렉션 URI 재확인

다음이 정확히 등록되어 있어야 함:
```
http://ludwig1824.synology.me:65104/api/auth/google/callback
```

**주의사항**:
- `http://` (https 아님)
- 포트 번호 정확히 `65104`
- 끝에 `/` 없음
- `/api/auth/google/callback` 경로 정확

#### 5. 새 클라이언트 생성 (최후의 수단)

기존 클라이언트에 문제가 있다면:
1. Google Cloud Console에서 **새 OAuth 2.0 클라이언트 ID** 생성
2. 애플리케이션 유형: **웹 애플리케이션**
3. 승인된 리디렉션 URI 추가:
   ```
   http://ludwig1824.synology.me:65104/api/auth/google/callback
   ```
4. 생성된 클라이언트 ID와 보안 비밀번호를 `.env`에 업데이트
5. 컨테이너 재시작:
   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

---

## 개발 환경 일반 문제

### CORS 에러

**증상**: `Access-Control-Allow-Origin` 에러

**해결**: 
- `.env`에서 `REACT_APP_API_URL` **비우기**
- 프록시 사용 (`setupProxy.js`)

### 프록시 404 에러

**증상**: `/api/xxx` 요청이 404

**해결**:
- `setupProxy.js`에 `pathRewrite` 설정 확인
- 백엔드 라우터 prefix에 `/api` 없는지 확인

### 환경변수 로드 안 됨

**증상**: 컨테이너에서 환경변수가 없음

**해결**:
- `docker-compose.dev.yml`에 `env_file` 설정 확인
- `restart` 대신 `down/up` 사용

---

## 유용한 명령어

```bash
# 환경변수 확인
docker exec eventer-map-backend-dev env | grep GOOGLE

# 컨테이너 로그
docker logs eventer-map-backend-dev --tail 50 -f
docker logs eventer-map-frontend-dev --tail 50 -f

# 완전 재시작 (환경변수 변경 시)
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d

# 특정 서비스만 재시작
docker-compose -f docker-compose.dev.yml restart backend
```
