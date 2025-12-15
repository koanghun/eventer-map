# 개발 환경 구조 개선 가이드

## 📌 개선 사항

기존의 별도 SSH 컨테이너 방식에서 **백엔드/프론트엔드 컨테이너에 SSH를 직접 내장**하는 방식으로 변경되었습니다.

### 이전 구조의 문제점
- ❌ SSH 컨테이너는 백엔드/프론트엔드 환경과 분리됨
- ❌ Python 패키지가 설치되지 않아 디버깅/테스트 불가
- ❌ Docker 명령어 실행 불가
- ❌ 실제 실행 환경에서 코딩할 수 없음

### 새로운 구조의 장점
- ✅ 각 컨테이너에서 직접 SSH 접속 가능
- ✅ IDE 디버거를 백엔드에서 직접 사용 가능
- ✅ 모든 패키지와 의존성이 설치된 환경에서 작업
- ✅ Hot reload 실시간 확인 가능
- ✅ 개발 워크플로우 대폭 개선

## 🚀 사용 방법

### 1. 컨테이너 재빌드 및 시작

```bash
# 기존 컨테이너 중지 및 제거
docker-compose -f docker-compose.dev.yml down

# 새로운 이미지로 빌드 및 시작
docker-compose -f docker-compose.dev.yml up -d --build
```

### 2. SSH 접속

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

### 3. VS Code Remote SSH 설정

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

이제 VS Code에서 `Remote-SSH: Connect to Host`로 간편하게 접속 가능합니다!

## 🐛 Python 디버깅

VS Code Remote SSH로 백엔드 컨테이너에 접속하면, **일반적인 Python 디버깅을 그대로 사용**할 수 있습니다:

1. SSH로 백엔드 접속 (`eventer-backend`)
2. 코드에 breakpoint 설정
3. **F5** 누르거나 디버그 시작
4. 끝!

별도의 원격 디버거 설정이 필요 없습니다. 컨테이너 내부에서 직접 디버깅하기 때문입니다.

## 📂 포트 매핑

| 서비스 | 포트 | 용도 | 환경 변수 |
|--------|------|------|-----------|
| 백엔드 | 7773 | FastAPI | `BACKEND_PORT` |
| 백엔드 SSH | 2222 | SSH 접속 | `BACKEND_SSH_PORT` |
| 프론트엔드 | 7772 | React Dev Server | `FRONTEND_PORT` |
| 프론트엔드 SSH | 2223 | SSH 접속 | `FRONTEND_SSH_PORT` |
| ~~SSH 서버~~ | ~~7774~~ | *(더 이상 사용하지 않음)* | - |

## 💡 팁

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

### 로그 확인
```bash
# 백엔드 로그
docker logs -f eventer-map-backend-dev

# 프론트엔드 로그
docker logs -f eventer-map-frontend-dev
```

## 🔒 보안

프로덕션 배포 시에는:
1. SSH 포트를 닫거나
2. `docker-compose.yml` (프로덕션용)을 사용하세요

개발 환경(`docker-compose.dev.yml`)만 SSH가 활성화되어 있습니다.

## 📝 기존 SSH 컨테이너 제거

기존 SSH 컨테이너는 profile로 설정되어 있어 자동으로 시작되지 않습니다.
완전히 제거하려면:

```bash
docker rm eventer-map-ssh
```

또는 `docker-compose.dev.yml`에서 `openssh-server` 서비스를 삭제하세요.
