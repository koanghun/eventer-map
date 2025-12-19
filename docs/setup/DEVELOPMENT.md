# 개발 환경 설정 가이드

이 가이드는 eventer-map 프로젝트의 개발 환경 설정 방법을 설명합니다.

## 📋 목차

- [개발 환경 아키텍처](#개발-환경-아키텍처)
- [SSH 컨테이너 통합 방식](#ssh-컨테이너-통합-방식)
- [환경 설정](#환경-설정)
- [Docker Compose 실행](#docker-compose-실행)
- [VS Code Remote SSH 연동](#vs-code-remote-ssh-연동)
- [디버깅](#디버깅)
- [트러블슈팅](#트러블슈팅)

---

## 개발 환경 아키텍처

### 📌 현재 구조 (개선됨)

기존의 별도 SSH 컨테이너 방식에서 **백엔드/프론트엔드 컨테이너에 SSH를 직접 내장**하는 방식으로 변경되었습니다.

#### 이전 구조의 문제점
- ❌ SSH 컨테이너는 백엔드/프론트엔드 환경과 분리됨
- ❌ Python 패키지가 설치되지 않아 디버깅/테스트 불가
- ❌ Docker 명령어 실행 불가
- ❌ 실제 실행 환경에서 코딩할 수 없음

#### 새로운 구조의 장점
- ✅ 각 컨테이너에서 직접 SSH 접속 가능
- ✅ IDE 디버거를 백엔드에서 직접 사용 가능
- ✅ 모든 패키지와 의존성이 설치된 환경에서 작업
- ✅ Hot reload 실시간 확인 가능
- ✅ 개발 워크플로우 대폭 개선

#### 컨테이너 구성

```
개발 환경 (docker-compose.dev.yml)
├── backend (FastAPI + SSH)
│   ├── 포트: 7773 (API)
│   ├── 포트: 2222 (SSH)
│   └── 볼륨: ./backend → /app
├── frontend (React + SSH)
│   ├── 포트: 7772 (Dev Server)
│   ├── 포트: 2223 (SSH)
│   └── 볼륨: ./frontend → /app
└── backend-data (SQLite 볼륨)
```

---

## SSH 컨테이너 통합 방식

### 포트 매핑

| 서비스 | 포트 | 용도 | 환경 변수 |
|--------|------|------|-----------|
| 백엔드 | 7773 | FastAPI | `BACKEND_PORT` |
| 백엔드 SSH | 2222 | SSH 접속 | `BACKEND_SSH_PORT` |
| 프론트엔드 | 7772 | React Dev Server | `FRONTEND_PORT` |
| 프론트엔드 SSH | 2223 | SSH 접속 | `FRONTEND_SSH_PORT` |

### SSH 접속 방법

#### 백엔드 컨테이너 접속
```bash
ssh -p 2222 developer@<NAS_IP>
# 예: ssh -p 2222 developer@192.168.1.100
```

#### 프론트엔드 컨테이너 접속
```bash
ssh -p 2223 developer@<NAS_IP>
# 예: ssh -p 2223 developer@192.168.1.100
```

**기본 비밀번호**: `changeme` (`.env` 파일의 `USER_PASSWORD`에서 변경 가능)

---

## 환경 설정

### 1. 환경 변수 파일 생성

개발 환경용 `.env` 파일을 생성합니다:

```bash
cp .env.example .env
```

`.env` 파일 내용 예시:
```bash
# 백엔드 설정
BACKEND_PORT=7773
BACKEND_SSH_PORT=2222
DATABASE_URL=sqlite:///./data/eventer.db
CORS_ORIGINS=http://localhost:7772,http://localhost

# 프론트엔드 설정
FRONTEND_PORT=7772
FRONTEND_SSH_PORT=2223
REACT_APP_API_URL=http://localhost:7773
REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here

# SSH 사용자 설정
USER_PASSWORD=changeme

# 기타
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

자세한 환경 변수 설명은 [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)를 참조하세요.

### 2. SSH 키 등록 (선택사항)

비밀번호 대신 SSH 키를 사용하려면:

```bash
# 공개 키를 .env 파일에 추가
PUBLIC_KEY=$(cat ~/.ssh/id_rsa.pub)
echo "PUBLIC_KEY=$PUBLIC_KEY" >> .env
```

---

## Docker Compose 실행

### 초기 빌드 및 시작

```bash
# 이미지 빌드 및 컨테이너 시작
docker-compose -f docker-compose.dev.yml up -d --build
```

### 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose -f docker-compose.dev.yml ps

# 로그 확인
docker-compose -f docker-compose.dev.yml logs -f

# 특정 서비스 로그만 확인
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend
```

### 재시작 시나리오

```bash
# 1. 처음 시작 (이미지 빌드 + 컨테이너 시작)
docker-compose -f docker-compose.dev.yml up -d

# 2. Dockerfile 수정 시 (재빌드 필요)
docker-compose -f docker-compose.dev.yml up -d --build

# 3. 코드만 수정 (개발 모드에서는 자동 반영, 재시작 불필요!)
# 아무것도 안 해도 됨

# 4. .env 수정 시 (재시작만)
docker-compose -f docker-compose.dev.yml restart

# 5. 완전히 새로 시작
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d --build
```

### 중지 및 제거

```bash
# 컨테이너 중지
docker-compose -f docker-compose.dev.yml down

# 볼륨까지 삭제 (데이터베이스 초기화)
docker-compose -f docker-compose.dev.yml down -v
```

---

## VS Code Remote SSH 연동

### SSH Config 설정

`~/.ssh/config`에 다음 내용 추가:

```
# 백엔드 컨테이너
Host eventer-backend
    HostName <NAS_IP>
    Port 2222
    User developer
    
# 프론트엔드 컨테이너
Host eventer-frontend
    HostName <NAS_IP>
    Port 2223
    User developer
```

### VS Code에서 접속

1. VS Code에서 `Remote-SSH: Connect to Host` 실행
2. `eventer-backend` 또는 `eventer-frontend` 선택
3. 비밀번호 입력 (기본값: `changeme`)
4. `/app` 디렉토리 열기

이제 컨테이너 내부에서 직접 코딩하고 디버깅할 수 있습니다!

---

## 디버깅

### Python 디버깅 (백엔드)

VS Code Remote SSH로 백엔드 컨테이너에 접속하면, **일반적인 Python 디버깅을 그대로 사용**할 수 있습니다:

1. SSH로 백엔드 접속 (`eventer-backend`)
2. 코드에 breakpoint 설정
3. **F5** 누르거나 디버그 시작
4. 끝!

별도의 원격 디버거 설정이 필요 없습니다. 컨테이너 내부에서 직접 디버깅하기 때문입니다.

### 백엔드에서 Python 코드 테스트

```bash
# SSH로 백엔드 접속 후
ssh -p 2222 developer@<NAS_IP>

cd /app
python test_duplicate_fix.py  # 모든 패키지가 설치되어 있음!
```

### 프론트엔드에서 npm 명령어 실행

```bash
# SSH로 프론트엔드 접속 후
ssh -p 2223 developer@<NAS_IP>

cd /app
npm run build  # 가능!
npm test       # 가능!
```

---

## 트러블슈팅

### SSH 접속 실패

**증상**: `Connection refused` 또는 비밀번호가 맞지 않음

**해결**:
```bash
# 컨테이너가 실행 중인지 확인
docker-compose -f docker-compose.dev.yml ps

# SSH 서비스 상태 확인
docker exec eventer-map-backend-dev ps aux | grep sshd
docker exec eventer-map-frontend-dev ps aux | grep sshd

# .env 파일의 USER_PASSWORD 확인
cat .env | grep USER_PASSWORD
```

### 포트 충돌

**증상**: `port is already allocated` 에러

**해결**:
```bash
# .env 파일에서 포트 변경
BACKEND_PORT=7783
BACKEND_SSH_PORT=2232
FRONTEND_PORT=7782
FRONTEND_SSH_PORT=2233

# 재시작
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

### Hot Reload가 작동하지 않음

**증상**: 코드 변경이 반영되지 않음

**해결**:
```bash
# 볼륨 마운트 확인
docker inspect eventer-map-backend-dev | grep Mounts -A 10

# 재시작
docker-compose -f docker-compose.dev.yml restart
```

더 많은 트러블슈팅은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)를 참조하세요.

---

## 💡 팁

### 컨테이너 내부에서 호스트 파일 편집

컨테이너 내부의 `/app` 디렉토리는 호스트의 프로젝트 디렉토리와 동기화되므로, 컨테이너에서 파일을 수정하면 호스트에서도 바로 반영됩니다.

### 다중 터미널 사용

여러 터미널 창을 열어서:
- 터미널 1: 백엔드 SSH 접속
- 터미널 2: 프론트엔드 SSH 접속
- 터미널 3: 호스트에서 Git 작업
- 터미널 4: Docker 로그 모니터링

### 로그 모니터링

```bash
# 실시간 로그 확인
docker-compose -f docker-compose.dev.yml logs -f

# 최근 로그만 확인
docker-compose -f docker-compose.dev.yml logs --tail=100
```

---

## 🔒 보안

프로덕션 배포 시에는:
1. SSH 포트를 닫거나
2. `docker-compose.pro.yml` (프로덕션용)을 사용하세요

개발 환경(`docker-compose.dev.yml`)만 SSH가 활성화되어 있습니다.

---

## 📚 관련 문서

- [환경 변수 설정](./ENVIRONMENT_VARIABLES.md)
- [Google OAuth 설정](./GOOGLE_OAUTH_SETUP.md)
- [트러블슈팅](./TROUBLESHOOTING.md)
- [프로젝트 개요](../PROJECT_OVERVIEW.md)

---

**개발 환경 설정 완료!** 🎉 이제 `http://localhost:7772`에서 개발 서버에 접속할 수 있습니다.
