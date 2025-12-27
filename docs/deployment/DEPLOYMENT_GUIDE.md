# 배포 가이드

eventer-map 프로젝트를 프로덕션 환경에 배포하는 종합 가이드입니다.

## 📋 목차

- [배포 전 체크리스트](#배포-전-체크리스트)
- [환경 변수 설정](#환경-변수-설정)
- [Google Maps API 설정](#google-maps-api-설정)
- [Docker Compose 배포](#docker-compose-배포)
- [Synology NAS 특화 설정](#synology-nas-특화-설정)
- [외부 접근 설정](#외부-접근-설정)
- [MyDNS.jp 설정](#mydnsjp-설정)
- [트러블슈팅](#트러블슈팅)
- [업데이트 및 유지보수](#업데이트-및-유지보수)

---

## 배포 전 체크리스트

### 필수 준비사항

- [ ] Docker 및 Docker Compose 설치 확인
- [ ] Google Maps API 키 발급 및 제한 설정
- [ ] NAS IP 주소 또는 도메인 확인
- [ ] 환경 변수 파일(`.env`) 준비
- [ ] 방화벽/포트 설정 확인

---

## 환경 변수 설정

### 1. `.env` 파일 생성

프로젝트 루트 디렉토리에서:

```bash
cp .env.example .env
```

### 2. 프로덕션 환경 변수 설정

`.env` 파일을 열고 다음 값들을 **실제 환경에 맞게** 수정하세요:

```bash
# Backend
DATABASE_URL=sqlite:///./data/eventer.db
CORS_ORIGINS=http://192.168.1.100:65104,http://your-domain.com
FRONTEND_URL=http://192.168.1.100:65104

# Frontend
REACT_APP_API_URL=http://192.168.1.100:65105  # NAS IP 또는 도메인
REACT_APP_GOOGLE_MAPS_API_KEY=실제_API_키_입력

# Ports
BACKEND_PORT=65105
FRONTEND_PORT=65104

# Google OAuth (사용 시)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://192.168.1.100:65105/api/auth/google/callback

# JWT (사용 시)
JWT_SECRET_KEY=your-very-secure-random-secret-key-change-this
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

> [!IMPORTANT]
> **필수 수정 항목**
> 1. `CORS_ORIGINS`: 프론트엔드에 접속할 모든 URL 추가 (쉼표로 구분, 공백 없이)
> 2. `REACT_APP_API_URL`: 백엔드 API 주소 (NAS IP 또는 도메인)
> 3. `REACT_APP_GOOGLE_MAPS_API_KEY`: Google Maps API 키 입력

자세한 환경 변수 설명은 [ENVIRONMENT_VARIABLES.md](../setup/ENVIRONMENT_VARIABLES.md)를 참조하세요.

---

## Google Maps API 설정

> [!CAUTION]
> **API 키 보안 설정 필수!**  
> API 키 제한을 설정하지 않으면 무단 사용으로 인한 요금 폭탄이 발생할 수 있습니다.

### 1. API 활성화

[Google Cloud Console](https://console.cloud.google.com/)에서:

1. 프로젝트 생성 또는 선택
2. **API 및 서비스** → **라이브러리**
3. 다음 API 활성화:
   - Maps JavaScript API
   - Geocoding API

### 2. API 키 생성

1. **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **API 키** 선택
3. 생성된 API 키 복사

### 3. API 키 제한 설정 (필수!)

#### 애플리케이션 제한사항

**HTTP 리퍼러(웹사이트)** 선택 후 허용할 도메인/IP 추가:

```
http://localhost:65104/*
http://192.168.1.100:65104/*  # NAS IP
https://yourdomain.com/*      # 도메인 사용 시
```

#### API 제한사항

**키 제한** 선택 후 다음 API만 허용:
- ✅ Maps JavaScript API
- ✅ Geocoding API

### 4. IP 주소 제한 (선택사항, 더 강력한 보안)

**IP 주소** 선택 후 NAS의 공인 IP 주소 추가

---

## Docker Compose 배포

### 1. 이미지 빌드

```bash
docker-compose -f docker-compose.pro.yml build
```

예상 소요 시간: 5-10분 (첫 빌드 시)

### 2. 컨테이너 실행

```bash
docker-compose -f docker-compose.pro.yml up -d
```

- `-d`: 백그라운드에서 실행
- 컨테이너 이름:
  - `eventer-map-backend`
  - `eventer-map-frontend`

### 3. 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose -f docker-compose.pro.yml ps

# 로그 확인 (실시간)
docker-compose -f docker-compose.pro.yml logs -f

# 특정 서비스 로그만 확인
docker-compose -f docker-compose.pro.yml logs -f backend
docker-compose -f docker-compose.pro.yml logs -f frontend
```

예상 출력:
```
NAME                      STATUS          PORTS
eventer-map-backend       Up 2 minutes    0.0.0.0:65105->8000/tcp
eventer-map-frontend      Up 2 minutes    0.0.0.0:65104->80/tcp
```

### 4. 접속 확인

- **프론트엔드**: `http://NAS-IP:65104`
- **백엔드 API**: `http://NAS-IP:65105`
- **API 문서**: `http://NAS-IP:65105/docs`

### 5. Health Check

```bash
curl http://localhost:65105/health
```

출력: `{"status":"healthy"}`

### 6. 재시작 및 업데이트

```bash
# 재시작 (코드 변경 없이)
docker-compose -f docker-compose.pro.yml restart

# 재빌드 후 재시작 (코드 변경 시)
docker-compose -f docker-compose.pro.yml down
docker-compose -f docker-compose.pro.yml build
docker-compose -f docker-compose.pro.yml up -d

# 환경 변수만 변경 시
docker-compose -f docker-compose.pro.yml down
docker-compose -f docker-compose.pro.yml up -d
```

### 7. 중지 및 제거

```bash
# 중지
docker-compose -f docker-compose.pro.yml down

# 볼륨까지 삭제 (주의: 데이터베이스 삭제됨)
docker-compose -f docker-compose.pro.yml down -v
```

---

## Synology NAS 특화 설정

### 1. Container Manager 설치

1. Synology DSM 로그인
2. **패키지 센터** 열기
3. **Container Manager** 검색 및 설치
4. 설치 완료 후 **열기**

### 2. 프로젝트 업로드

#### 방법 A: SSH를 통한 Git Clone (권장)

```bash
# NAS에 SSH 접속
ssh admin@<NAS_IP>

# 프로젝트 디렉토리로 이동
cd /volume1/docker  # 또는 /volume2/docker

# Git 저장소 클론
git clone https://github.com/your-username/eventer-map.git
cd eventer-map

# .env 파일 생성 및 수정
cp .env.example .env
vi .env  # 또는 nano .env
```

#### 방법 B: File Station을 통한 업로드

1. **File Station** 열기
2. `docker` 폴더 생성 (없는 경우)
3. 로컬 프로젝트 폴더 전체를 업로드
4. `.env` 파일 생성 및 수정

### 3. Container Manager에서 배포

#### UI를 통한 배포

1. **Container Manager** 열기
2. **프로젝트** 탭 선택
3. **생성** 버튼 클릭
4. 설정:
   - **프로젝트 이름**: `eventer-map`
   - **경로**: `/volume1/docker/eventer-map` (또는 실제 경로)
   - **소스**: `docker-compose.yml 파일을 사용하여 프로젝트 생성`
5. **다음** 클릭
6. `docker-compose.pro.yml` 선택
7. **완료** 클릭하여 빌드 시작

#### SSH를 통한 배포

```bash
cd /volume1/docker/eventer-map
sudo docker-compose -f docker-compose.pro.yml up -d --build
```

### 4. 포트 설정

Synology에서는 1024 이하 포트 사용에 제한이 있을 수 있으므로, 높은 포트 번호를 사용합니다:

```bash
# .env 파일에서
BACKEND_PORT=65105
FRONTEND_PORT=65104
```

### 5. 방화벽 설정

**제어판** → **보안** → **방화벽**:
- 포트 65105, 65104 허용 (필요 시)

---

## 외부 접근 설정

### 1. 포트 포워딩

공유기에서 설정:
- 외부 포트 `65104` → NAS IP:65104 (프론트엔드)
- 외부 포트 `65105` → NAS IP:65105 (백엔드)

### 2. 역방향 프록시 (권장)

#### Synology DSM 역방향 프록시

1. **제어판** → **로그인 포털** → **고급** → **역방향 프록시**
2. **생성** 클릭
3. 설정:
   - **소스**: `https://eventermap.yourdomain.com`
   - **대상**: `http://localhost:65104`

이제 하나의 도메인으로 접근 가능:
- `https://eventermap.yourdomain.com` → 프론트엔드
- `https://eventermap.yourdomain.com/api` → 백엔드 (추가 설정 필요)

### 3. HTTPS 설정

#### Let's Encrypt 인증서

1. **제어판** → **보안** → **인증서**
2. **추가** → **새 인증서 추가**
3. **Let's Encrypt에서 인증서 받기**
4. 도메인 입력 및 인증

---

## MyDNS.jp 설정

> [!IMPORTANT]
> **Dynamic DNS 자동 업데이트 필수!**  
> MyDNS.jp는 정기적인 IP 주소 업데이트가 필요합니다. 7일 이상 업데이트하지 않으면 서비스가 중단됩니다!

### 왜 필요한가요?

`eventermap.mydns.jp` 도메인은 Dynamic DNS 서비스를 사용합니다. 가정용 인터넷의 공인 IP는 수시로 변경될 수 있으므로, 현재 IP를 MyDNS에 자동으로 알려줘야 합니다.

### 빠른 시작

#### 1. 즉시 IP 업데이트 (긴급)

경고 메일을 받았다면 먼저 수동으로 업데이트:

```bash
curl -u "mydns786724:비밀번호" "https://ipv6.mydns.jp/login.html"
```

**비밀번호**를 실제 MyDNS 비밀번호로 변경하세요.

#### 2. 자동 업데이트 스크립트 설정

```bash
# SSH로 NAS 접속 후
cd /volume1/docker/eventer-map

# 스크립트 편집하여 비밀번호 입력
vi scripts/update_mydns_ip.sh
# MYDNS_PASSWORD="YOUR_PASSWORD_HERE" ← 실제 비밀번호로 변경

# 테스트 실행
./scripts/update_mydns_ip.sh
```

예상 출력:
```
==========================================
[2025-12-25 10:30:15] MyDNS IP 업데이트 시작
[2025-12-25 10:30:16] 현재 공인 IP: 123.456.789.012
[2025-12-25 10:30:17] ✅ 업데이트 성공!
==========================================
```

#### 3. Synology 작업 스케줄러 설정

1. **제어판** → **작업 스케줄러** 열기
2. **생성** → **예약된 작업** → **사용자 정의 스크립트**
3. 일반 설정:
   - **작업 이름**: `MyDNS IP 자동 업데이트`
   - **사용자**: `root`
   - **사용**: ✅ 체크
4. 스케줄 설정:
   - **날짜**: 매일
   - **시간**: 반복 - `매 6시간마다` (00:00, 06:00, 12:00, 18:00)
5. **사용자 정의 스크립트** 탭에 다음 내용 붙여넣기 후 **비밀번호 수정**:
   ```bash
   #!/bin/bash
   MYDNS_MASTER_ID="mydns786724"
   MYDNS_PASSWORD="실제_비밀번호"  # ← 수정 필수!
   LOG_DIR="/volume2/docker/eventer-map/logs"
   mkdir -p "$LOG_DIR"
   echo "[$(date '+%Y-%m-%d %H:%M:%S')] MyDNS IP 업데이트" >> "$LOG_DIR/mydns.log"
   curl -s -u "$MYDNS_MASTER_ID:$MYDNS_PASSWORD" "https://ipv6.mydns.jp/login.html" >> "$LOG_DIR/mydns.log"
   ```
6. **확인** 클릭 → 작업 선택 후 **실행** 버튼으로 즉시 테스트

#### 4. 로그 확인

```bash
# 업데이트 로그 확인
tail -f /volume1/docker/eventer-map/logs/mydns_update.log
```

### 📖 상세 가이드

모든 설정 방법, 트러블슈팅, 보안 설정은 [MyDNS 설정 가이드](./MYDNS_SETUP.md)를 참조하세요.

### ⚠️ 주의사항

- **업데이트 주기**: 최소 일주일에 1회, 권장 6시간마다
- **경고 시점**: 7일 이상 미업데이트 시 경고
- **서비스 중단**: 30일 이상 미업데이트 시 데이터 삭제

---

## 트러블슈팅

### 문제 1: 지도가 로드되지 않음

**원인**: Google Maps API 키 문제

**해결**:
1. `.env` 파일에 API 키가 올바르게 입력되었는지 확인
2. Google Cloud Console에서 API 제한 설정 확인
3. 브라우저 콘솔(F12)에서 에러 메시지 확인

```bash
# 재빌드 필요 (프론트엔드는 빌드 시 환경 변수 주입)
docker-compose -f docker-compose.pro.yml down
docker-compose -f docker-compose.pro.yml build --no-cache frontend
docker-compose -f docker-compose.pro.yml up -d
```

### 문제 2: API 호출 CORS 에러

**원인**: CORS_ORIGINS 설정 누락

**해결**:
1. `.env` 파일의 `CORS_ORIGINS`에 프론트엔드 URL 추가
2. 백엔드만 재시작하면 됨 (빌드 불필요)

```bash
docker-compose -f docker-compose.pro.yml restart backend
docker-compose -f docker-compose.pro.yml logs -f backend
```

### 문제 3: 데이터가 사라짐

**원인**: Docker 볼륨 문제

**해결**:
```bash
# 볼륨 확인
docker volume ls | grep eventer

# 볼륨 상세 정보
docker volume inspect eventer-map_backend-data

# 데이터 백업 (정기적으로 수행)
docker cp eventer-map-backend:/app/data/eventer.db ./backups/
```

백업 가이드는 [backup-guide.md](../operations/backup-guide.md)를 참조하세요.

### 문제 4: 컨테이너가 시작되지 않음

**해결**:
```bash
# 로그 확인
docker-compose -f docker-compose.pro.yml logs

# 컨테이너 재시작
docker-compose -f docker-compose.pro.yml restart

# 완전히 재빌드
docker-compose -f docker-compose.pro.yml down
docker-compose -f docker-compose.pro.yml up -d --build --force-recreate
```

### 문제 5: 포트 충돌

**증상**: `port already allocated` 오류

**해결**:
```bash
# .env 파일에서 포트 변경
BACKEND_PORT=65106
FRONTEND_PORT=65105

# 재시작
docker-compose -f docker-compose.pro.yml down
docker-compose -f docker-compose.pro.yml up -d
```

---

## 업데이트 및 유지보수

### 코드 업데이트

```bash
# 1. 코드 업데이트 (Git 사용 시)
cd /volume1/docker/eventer-map
git pull origin main

# 2. 재빌드 및 재시작
docker-compose -f docker-compose.pro.yml down
docker-compose -f docker-compose.pro.yml build
docker-compose -f docker-compose.pro.yml up -d

# 3. 로그 확인
docker-compose -f docker-compose.pro.yml logs -f
```

### 데이터베이스 백업

정기 백업은 매우 중요합니다! 자세한 내용은 [백업 가이드](../operations/backup-guide.md)를 참조하세요.

#### 수동 백업

```bash
# 데이터베이스 백업
docker cp eventer-map-backend:/app/data/eventer.db ./backups/eventer-$(date +%Y%m%d).db

# 또는 백업 스크립트 사용
./scripts/backup-db.sh
```

#### 자동 백업 (Cron)

```bash
# 매일 새벽 3시 백업
0 3 * * * /volume1/docker/eventer-map/scripts/backup-db.sh >> /volume1/docker/eventer-map/backups/cron.log 2>&1
```

### 로그 관리

```bash
# 실시간 로그 보기
docker-compose -f docker-compose.pro.yml logs -f

# 최근 100줄만 보기
docker-compose -f docker-compose.pro.yml logs --tail=100

# 특정 서비스 로그
docker-compose -f docker-compose.pro.yml logs -f backend
```

### 모니터링

Container Manager에서 리소스 사용량 확인:
1. **Container Manager** → **컨테이너** 탭
2. 각 컨테이너의 CPU, 메모리 사용량 확인

---

## 배포 검증 체크리스트

배포 후 다음 항목들을 확인하세요:

- [ ] 프론트엔드 접속 확인 (`http://NAS-IP:65104`)
- [ ] 지도 로드 확인
- [ ] 백엔드 API 응답 확인 (`http://NAS-IP:65105/docs`)
- [ ] 이벤트 등록 기능 테스트
- [ ] 이벤트 조회 기능 테스트
- [ ] 날짜 필터링 기능 테스트
- [ ] 모바일 브라우저 테스트
- [ ] 백업 스크립트 실행 확인

---

## 📚 관련 문서

- [프로젝트 개요](../PROJECT_OVERVIEW.md)
- [현재 상태](../CURRENT_STATUS.md)
- [환경 변수 설정](../setup/ENVIRONMENT_VARIABLES.md)
- [MyDNS.jp 설정 가이드](./MYDNS_SETUP.md)
- [백업 가이드](../operations/backup-guide.md)

---

**🎉 배포 성공!** 이제 `http://NAS-IP:65104`에서 eventer-map 애플리케이션을 사용할 수 있습니다.
