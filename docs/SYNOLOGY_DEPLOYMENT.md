# Synology NAS 배포 가이드

이 가이드는 eventer-map 프로젝트를 시놀로지 NAS의 Container Manager를 사용하여 배포하는 방법을 설명합니다.

## 사전 준비사항

### 1. Container Manager 설치

1. Synology DSM에 로그인
2. **패키지 센터** 열기
3. **Container Manager** 검색 및 설치
4. 설치 완료 후 **열기**

### 2. SSH 접근 활성화 (선택사항, 명령줄 배포 시 필요)

1. **제어판** > **터미널 및 SNMP**
2. **SSH 서비스 활성화** 체크
3. 포트: 기본값(22) 또는 변경된 포트 확인

### 3. 필수 정보 준비

다음 정보를 미리 준비하세요:

- ✅ **NAS IP 주소**: 예) `192.168.1.100`
- ✅ **Google Maps API 키**: [발급 방법](#google-maps-api-키-발급)
- ✅ **배포 경로**: 프로젝트가 이미 `/volume2/docker/eventer-map`에 클론되어 있음

## 배포 과정

### 단계 1: 환경 변수 설정

프로젝트 디렉토리에서 환경 변수 파일을 생성합니다.

#### SSH를 통한 방법

```bash
# NAS에 SSH 접속
ssh admin@<NAS_IP>

# 프로젝트 디렉토리로 이동
cd /volume2/docker/eventer-map

# .env.production을 .env로 복사
cp .env.production .env

# 환경 변수 파일 편집
vi .env  # 또는 nano .env
```

#### File Station을 통한 방법

1. **File Station** 열기
2. `/volume2/docker/eventer-map` 경로로 이동
3. `.env.production` 파일을 복사하여 `.env`로 이름 변경
4. `.env` 파일을 우클릭 > **편집**
5. 아래 값들을 수정:

```bash
# CORS 설정 (NAS IP로 변경)
CORS_ORIGINS=http://192.168.1.100:3000,http://192.168.1.100

# Google Maps API 키 (실제 키로 변경)
REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_ACTUAL_API_KEY_HERE

# 포트 설정 (필요시 변경)
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

> [!IMPORTANT]
> - `192.168.1.100`을 실제 NAS IP 주소로 변경하세요
> - Google Maps API 키는 반드시 실제 발급받은 키로 변경해야 합니다

### 단계 2: Docker 이미지 빌드 및 실행

#### 방법 A: SSH를 통한 배포 (권장)

```bash
# 프로젝트 디렉토리에서 실행
cd /volume2/docker/eventer-map

# Docker Compose로 빌드 및 실행
sudo docker-compose up -d --build
```

빌드 과정은 첫 실행 시 5-10분 정도 소요될 수 있습니다.

#### 방법 B: Container Manager UI를 통한 배포

1. **Container Manager** 열기
2. **프로젝트** 탭 선택
3. **생성** 버튼 클릭
4. 설정:
   - **프로젝트 이름**: `eventer-map`
   - **경로**: `/volume2/docker/eventer-map`
   - **소스**: `docker-compose.yml 파일을 사용하여 프로젝트 생성`
5. **다음** 클릭
6. Container Manager가 자동으로 `docker-compose.yml`을 감지
7. **완료** 클릭하여 빌드 시작

### 단계 3: 컨테이너 상태 확인

#### SSH를 통한 확인

```bash
# 컨테이너 상태 확인
sudo docker-compose ps

# 로그 확인 (문제 발생 시)
sudo docker-compose logs

# 특정 서비스 로그 확인
sudo docker-compose logs backend
sudo docker-compose logs frontend
```

정상적으로 실행되면 다음과 같이 표시됩니다:

```
NAME                      STATUS          PORTS
eventer-map-backend       Up (healthy)    0.0.0.0:8000->8000/tcp
eventer-map-frontend      Up (healthy)    0.0.0.0:3000->80/tcp
```

#### Container Manager UI를 통한 확인

1. **Container Manager** > **프로젝트** 탭
2. `eventer-map` 프로젝트 선택
3. 모든 컨테이너가 **실행 중** 상태인지 확인
4. **세부정보**에서 로그 확인 가능

### 단계 4: 애플리케이션 접근 테스트

브라우저에서 다음 주소로 접근하여 테스트합니다:

1. **프론트엔드**: `http://<NAS_IP>:3000`
   - 예: `http://192.168.1.100:3000`
   - 지도가 정상적으로 로드되는지 확인

2. **백엔드 API 문서**: `http://<NAS_IP>:8000/docs`
   - 예: `http://192.168.1.100:8000/docs`
   - FastAPI 자동 생성 문서 확인

3. **기능 테스트**:
   - [ ] 지도 로드 확인
   - [ ] 날짜 선택 기능
   - [ ] 이벤트 등록 (새 이벤트 추가)
   - [ ] 이벤트 마커 클릭하여 상세 정보 확인
   - [ ] 이벤트 수정/삭제

## 트러블슈팅

### 문제: 컨테이너가 시작되지 않음

**해결 방법:**

```bash
# 로그 확인
sudo docker-compose logs

# 컨테이너 재시작
sudo docker-compose restart

# 완전히 재빌드
sudo docker-compose down
sudo docker-compose up -d --build --force-recreate
```

### 문제: 프론트엔드는 열리지만 지도가 표시되지 않음

**원인:** Google Maps API 키 문제

**해결 방법:**

1. `.env` 파일의 `REACT_APP_GOOGLE_MAPS_API_KEY` 확인
2. Google Cloud Console에서 API 키 상태 확인
3. API 키 제한(리퍼러) 설정 확인
4. 값 수정 후 재빌드:

```bash
sudo docker-compose down
sudo docker-compose up -d --build
```

### 문제: API 호출 실패 (CORS 오류)

**원인:** CORS 설정 문제

**해결 방법:**

1. `.env` 파일의 `CORS_ORIGINS` 확인
2. 실제 접근하는 주소(NAS IP)가 포함되어 있는지 확인
3. 수정 후 백엔드만 재시작:

```bash
sudo docker-compose restart backend
```

### 문제: 포트 충돌

**증상:** 컨테이너가 실행되지 않고 "port already allocated" 오류

**해결 방법:**

1. `.env` 파일에서 포트 변경:

```bash
BACKEND_PORT=8001
FRONTEND_PORT=8080
```

2. 재시작:

```bash
sudo docker-compose down
sudo docker-compose up -d
```

### 문제: 데이터가 사라짐

**원인:** Docker 볼륨 문제

**해결 방법:**

데이터는 `backend-data` 볼륨에 저장됩니다. 볼륨 확인:

```bash
# 볼륨 목록 확인
sudo docker volume ls | grep eventer

# 볼륨 상세 정보
sudo docker volume inspect eventer-map_backend-data
```

볼륨을 삭제하지 않는 한 데이터는 유지됩니다.

## Google Maps API 키 발급

### 1. Google Cloud Console 접속

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. Google 계정으로 로그인

### 2. 프로젝트 생성

1. 상단의 프로젝트 드롭다운 클릭
2. **새 프로젝트** 클릭
3. 프로젝트 이름 입력 (예: `eventer-map`)
4. **만들기** 클릭

### 3. API 활성화

1. 좌측 메뉴 > **API 및 서비스** > **라이브러리**
2. **Maps JavaScript API** 검색 > **사용 설정**
3. **Geocoding API** 검색 > **사용 설정**

### 4. API 키 생성

1. 좌측 메뉴 > **API 및 서비스** > **사용자 인증 정보**
2. 상단 **+ 사용자 인증 정보 만들기** > **API 키** 선택
3. API 키가 생성됨 (복사해두기)

### 5. API 키 제한 설정 (보안 필수!)

1. 생성된 API 키 옆 **편집** (연필 아이콘) 클릭
2. **애플리케이션 제한사항**:
   - **HTTP 리퍼러(웹사이트)** 선택
   - **웹사이트 제한사항 추가**:
     ```
     http://192.168.1.100:3000/*
     http://localhost:3000/*
     ```
     (실제 NAS IP로 변경)

3. **API 제한사항**:
   - **키 제한** 선택
   - **Maps JavaScript API** 선택
   - **Geocoding API** 선택

4. **저장** 클릭

> [!WARNING]
> API 키 제한을 설정하지 않으면 누구나 해당 키를 사용할 수 있어 비용이 발생할 수 있습니다!

## 업데이트 및 유지보수

### 코드 업데이트

```bash
# 프로젝트 디렉토리로 이동
cd /volume2/docker/eventer-map

# Git에서 최신 코드 가져오기
git pull origin main

# 컨테이너 재빌드 및 재시작
sudo docker-compose down
sudo docker-compose up -d --build
```

### 백업

데이터베이스 백업 (SQLite):

```bash
# 볼륨에서 데이터 복사
sudo docker cp eventer-map-backend:/app/data/eventer.db /volume2/backups/eventer-$(date +%Y%m%d).db
```

정기 백업 스크립트 (선택사항):

```bash
#!/bin/bash
# /volume2/docker/eventer-map/backup.sh

BACKUP_DIR="/volume2/backups/eventer-map"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 데이터베이스 백업
docker cp eventer-map-backend:/app/data/eventer.db $BACKUP_DIR/eventer-$DATE.db

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "eventer-*.db" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/eventer-$DATE.db"
```

실행 권한 부여 및 크론 설정:

```bash
chmod +x /volume2/docker/eventer-map/backup.sh

# 크론탭 편집 (매일 새벽 2시 백업)
# 제어판 > 작업 스케줄러에서 설정 가능
```

### 로그 관리

로그는 자동으로 순환 저장됩니다 (최대 10MB × 3개 파일).

로그 확인:

```bash
# 실시간 로그 보기
sudo docker-compose logs -f

# 최근 100줄만 보기
sudo docker-compose logs --tail=100
```

## 외부 접근 설정 (선택사항)

### 포트 포워딩

공유기에서 설정:

- 외부 포트 `3000` → NAS IP `192.168.1.100:3000`
- 외부 포트 `8000` → NAS IP `192.168.1.100:8000`

### 무료 도메인 (차후 적용 예정)

추천 서비스:
- **DuckDNS**: 무료 동적 DNS
- **No-IP**: 무료 플랜 제공
- **Cloudflare**: 무료 DNS + CDN

설정 후 `.env` 파일의 `CORS_ORIGINS`를 도메인으로 업데이트:

```bash
CORS_ORIGINS=https://yourdomain.duckdns.org
```

### HTTPS 설정 (권장)

Synology의 역방향 프록시 또는 Let's Encrypt 사용:

1. **제어판** > **로그인 포털** > **고급** > **역방향 프록시**
2. **생성** 클릭
3. 설정 후 HTTPS로 접근 가능

## 리소스 모니터링

Container Manager에서 리소스 사용량 확인:

1. **Container Manager** > **컨테이너** 탭
2. 각 컨테이너의 CPU, 메모리 사용량 확인
3. 필요시 리소스 제한 설정:

```yaml
# docker-compose.yml에 추가 가능
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## 도움말 및 지원

문제가 계속되면 다음을 확인하세요:

- [ ] 로그 파일 확인 (`docker-compose logs`)
- [ ] 환경 변수 설정 확인 (`.env` 파일)
- [ ] 네트워크 연결 확인 (ping, 방화벽)
- [ ] Google Maps API 할당량 확인
- [ ] NAS 디스크 공간 확인

---

**배포 완료!** 🎉

이제 `http://<NAS_IP>:3000`에서 eventer-map 애플리케이션을 사용할 수 있습니다.
