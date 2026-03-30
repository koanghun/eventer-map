# 시놀로지 NAS 배포 가이드 (Container Manager)

이 가이드는 시놀로지 NAS의 **Container Manager**(이전 Docker)를 사용하여 Event Map 서비스를 배포하는 탄계를 안내합니다.

## 1. 사전 준비

### 1.1 폴더 구조 생성
NAS의 `File Station`을 사용하여 다음 폴더 구조를 만듭니다:
- `/volume1/docker/eventer-map`
  - `/backend` (백엔드 소스 복사)
  - `/frontend` (프론트엔드 소스 복사)
  - `/postgres_data` (자동 생성됨, DB 데이터 보관)
  - `/backend/data` (자동 생성됨, 백엔드 데이터 보관)

### 1.2 환경 변수 설정
1. 프로젝트 루트의 `.env.production` 파일을 `.env`로 복사합니다.
2. `.env` 파일을 열어 다음 항목을 실제 값으로 수정합니다:
   - `POSTGRES_PASSWORD`: 강력한 비밀번호로 변경
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google Cloud Console에서 발급받은 값
   - `REACT_APP_GOOGLE_MAPS_API_KEY`: Google Maps API 키
   - `CORS_ORIGINS`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`: 실제 도메인(`https://your-domain.mydns.jp`)으로 변경

## 2. Container Manager에서 프로젝트 생성

1. 시놀로지 DSM에서 **Container Manager**를 실행합니다.
2. 서브 메뉴에서 **프로젝트**를 클릭합니다.
3. **생성** 버튼을 누릅니다.
4. 다음 설정을 입력합니다:
   - **프로젝트 이름**: `eventer-map`
   - **경로**: `/volume1/docker/eventer-map` 선택
   - **소스**: `docker-compose.yml 생성` 선택
5. 아래의 `docker-compose.yml` 내용을 복사하여 붙여넣습니다:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: eventer-db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-eventer}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-eventer_db}
    volumes:
      - ./postgres_data:/var/lib/postgresql/data
    networks:
      - eventer-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: eventer-backend
    restart: always
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER:-eventer}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-eventer_db}
    depends_on:
      - postgres
    ports:
      - "${BACKEND_PORT:-7773}:8000"
    volumes:
      - ./backend/data:/app/data
    networks:
      - eventer-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - REACT_APP_API_URL=${REACT_APP_API_URL}
        - REACT_APP_GOOGLE_MAPS_API_KEY=${REACT_APP_GOOGLE_MAPS_API_KEY}
    container_name: eventer-frontend
    restart: always
    ports:
      - "${FRONTEND_PORT:-7772}:80"
    depends_on:
      - backend
    networks:
      - eventer-network

networks:
  eventer-network:
    driver: bridge
```

6. **다음**을 눌러 진행하고, 마법사를 완료합니다. 빌드가 시작되고 컨테이너가 실행됩니다.

## 3. 역방향 프록시(Reverse Proxy) 설정

외부에서 `https://your-domain.mydns.jp`로 접속할 수 있도록 설정합니다.

1. DSM **제어판** > **로그인 포털** > **고급** > **역방향 프록시**로 이동합니다.
2. **생성**을 클릭합니다.
3. **일반** 탭:
   - **역방향 프록시 이름**: `Event Map`
   - **소스**:
     - 프로토콜: `HTTPS`
     - 호스트 이름: `your-domain.mydns.jp`
     - 포트: `443`
   - **대상**:
     - 프로토콜: `HTTP`
     - 호스트 이름: `localhost`
     - 포트: `7772` (프론트엔드 포트)
4. **저장**을 누릅니다.

## 4. SSL 인증서 적용

1. DSM **제어판** > **보안** > **인증서**로 이동합니다.
2. `mydns.jp` 도메인에 대한 Let's Encrypt 인증서가 있는지 확인합니다. (없다면 **추가** 버튼을 통해 발급)
3. **설정** 버튼을 누릅니다.
4. 생성한 역방향 프록시(`Event Map`) 항목을 찾아 해당 도메인의 인증서를 선택하고 **확인**을 누릅니다.

## 5. 확인 및 로그 관리

- 브라우저에서 `https://your-domain.mydns.jp`로 접속하여 정상 작동하는지 확인합니다.
- 문제가 발생할 경우 **Container Manager** > **프로젝트** > `eventer-map` > **로그** 탭에서 상세 내용을 확인할 수 있습니다.

## 6. 이벤트 추출기 (Event Extractor) 수동 실행

`event-extractor`는 무거운 리소스 사용으로 인해 상시 가동되지 않도록 설정되어 있습니다. 필요할 때만 아래 명령어로 수동으로 실행해 주세요.

1. `.env` 파일에 `GOOGLE_APPLICATION_CREDENTIALS` (필요시) 및 기타 설정을 확인합니다.
2. `event-extractor` 폴더에 `credentials.json`과 `token.json`이 있는지 확인합니다.
3. 다음 명령어로 추출기를 실행합니다:

```bash
# 시놀로지 터미널에서 실행
docker-compose -f docker-compose.pro.yml run --rm event-extractor
```

수행이 완료되면 컨테이너는 자동으로 종료되고 삭제됩니다(`--rm` 옵션).
