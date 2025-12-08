# 프로덕션 배포 가이드

> 📅 **작성일**: 2025-11-26  
> 🎯 **목표**: Event Map 애플리케이션을 Synology NAS에 Docker Compose로 안전하게 배포  

---

## 📋 배포 전 체크리스트

### 1. 환경 변수 설정

#### ✅ 루트 디렉토리 `.env` 파일 생성

```bash
# 프로젝트 루트 디렉토리에서
cp .env.example .env
```

`.env` 파일을 열고 다음 값들을 **실제 환경에 맞게** 수정하세요:

```bash
# Backend
DATABASE_URL=sqlite:///./data/eventer.db
CORS_ORIGINS=http://192.168.1.100:3000,http://your-nas-ip:3000

# Frontend
REACT_APP_API_URL=http://192.168.1.100:8000  # NAS IP로 변경
REACT_APP_GOOGLE_MAPS_API_KEY=실제_API_키_입력

# Ports (선택사항, 기본값 사용 가능)
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

> [!IMPORTANT]
> **필수 수정 항목**
> 1. `CORS_ORIGINS`: 프론트엔드에 접속할 모든 URL 추가 (쉼표로 구분, 공백 없이)
> 2. `REACT_APP_API_URL`: 백엔드 API 주소 (NAS IP 또는 도메인)
> 3. `REACT_APP_GOOGLE_MAPS_API_KEY`: Google Maps API 키 입력

---

### 2. Google Maps API 키 보안 설정

> [!CAUTION]
> **API 키 보안 설정 필수!**  
> API 키 제한을 설정하지 않으면 무단 사용으로 인한 요금 폭탄이 발생할 수 있습니다.

#### Google Cloud Console 설정

1. **[Google Cloud Console](https://console.cloud.google.com/) 접속**

2. **API 제한 설정**
   - API 및 서비스 → 사용자 인증 정보
   - 해당 API 키 선택
   - "API 제한사항" 섹션에서 **"키 제한"** 선택
   - 다음 API만 허용:
     - ✅ Maps JavaScript API
     - ✅ Geocoding API

3. **HTTP 리퍼러 제한 설정** (권장)
   - "애플리케이션 제한사항" 섹션에서 **"HTTP 리퍼러(웹사이트)"** 선택
   - 허용할 도메인/IP 추가:
     ```
     http://localhost:3000/*
     http://192.168.1.100:3000/*  # NAS IP
     https://yourdomain.com/*      # 도메인 사용 시
     ```

4. **IP 주소 제한** (선택사항, 더 강력한 보안)
   - "애플리케이션 제한사항"에서 **"IP 주소"** 선택
   - NAS의 공인 IP 주소 추가

---

### 3. CORS 설정 확인

프론트엔드와 백엔드가 서로 다른 포트/도메인에서 실행되므로 CORS 설정이 필수입니다.

#### 백엔드 CORS 설정 확인

`.env` 파일의 `CORS_ORIGINS`에 프론트엔드 접속 URL을 **모두** 추가:

```bash
# 로컬 개발 + NAS 내부망 + 외부 도메인 모두 포함 가능
CORS_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,https://yourdomain.com
```

> [!TIP]
> **CORS 디버깅**  
> 브라우저 개발자 도구(F12) → Network 탭에서 API 요청 확인:
> - ✅ 정상: Status 200
> - ❌ CORS 에러: Status (failed), Console에 CORS policy 에러 메시지

---

## 🚀 Docker Compose 배포

### 1. 빌드

```bash
docker-compose build
```

예상 소요 시간: 5-10분 (첫 빌드 시)

### 2. 실행

```bash
docker-compose up -d
```

- `-d`: 백그라운드에서 실행
- 컨테이너 이름:
  - `eventer-map-backend`
  - `eventer-map-frontend`

### 3. 상태 확인

```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인 (실시간)
docker-compose logs -f

# 특정 서비스 로그만 확인
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. 접속 확인

- **프론트엔드**: `http://NAS-IP:3000` (또는 설정한 포트)
- **백엔드 API**: `http://NAS-IP:8000`
- **API 문서**: `http://NAS-IP:8000/docs`

### 5. 종료 및 재시작

```bash
# 중지
docker-compose down

# 재시작 (코드 변경 없이)
docker-compose restart

# 재빌드 후 재시작 (코드 변경 시)
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 🔒 Synology NAS 설정

### 1. Docker 패키지 설치

1. **패키지 센터** 열기
2. **Docker** 검색 및 설치
3. 설치 완료 후 **Docker** 앱 실행

### 2. 프로젝트 업로드

#### 방법 1: Git Clone (권장)

```bash
# SSH로 NAS 접속
ssh your-username@nas-ip

# 프로젝트 클론
cd /volume1/docker  # 또는 원하는 경로
git clone https://github.com/your-username/eventer-map.git
cd eventer-map

# .env 파일 생성 및 수정
cp .env.example .env
nano .env  # 또는 vi
```

#### 방법 2: File Station 업로드

1. **File Station** 열기
2. `docker` 폴더 생성 (없는 경우)
3. 로컬 프로젝트 폴더 전체를 업로드
4. `.env` 파일 생성 및 수정

### 3. 포트 포워딩 (외부 접속 시)

외부 네트워크에서 접속하려면 공유기 설정에서 포트 포워딩 필요:

- **백엔드**: `8000` → NAS IP:8000
- **프론트엔드**: `3000` → NAS IP:3000

또는 **역프록시** 사용 (권장):
- Synology DSM의 "응용 프로그램 포털" 사용
- HTTPS 인증서 적용 가능

### 4. 방화벽 설정

**제어판** → **보안** → **방화벽**:
- 포트 8000, 3000 허용 (필요 시)

---

## 🧪 배포 검증

### 1. 컨테이너 상태 확인

```bash
docker-compose ps
```

출력 예시:
```
NAME                      STATUS          PORTS
eventer-map-backend       Up 2 minutes    0.0.0.0:8000->8000/tcp
eventer-map-frontend      Up 2 minutes    0.0.0.0:3000->80/tcp
```

### 2. 백엔드 Health Check

```bash
curl http://localhost:8000/health
```

출력: `{"status":"healthy"}`

### 3. 데이터베이스 확인

```bash
docker exec -it eventer-map-backend ls -la /app/data
```

`eventer.db` 파일이 있는지 확인

### 4. 프론트엔드 접속 테스트

브라우저에서 `http://NAS-IP:3000` 접속:
- ✅ 지도가 정상적으로 로드되는가?
- ✅ 개발자 도구에서 API 호출이 성공하는가?
- ✅ 이벤트 등록/조회가 가능한가?

---

## 🐛 트러블슈팅

### 문제 1: 지도가 로드되지 않음

**원인**: Google Maps API 키 문제

**해결**:
1. `.env` 파일에 API 키가 올바르게 입력되었는지 확인
2. Google Cloud Console에서 API 제한 설정 확인
3. 브라우저 콘솔(F12)에서 에러 메시지 확인

```bash
# 재빌드 필요 (프론트엔드는 빌드 시 환경 변수 주입)
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d
```

### 문제 2: API 호출 CORS 에러

**원인**: CORS_ORIGINS 설정 누락

**해결**:
1. `.env` 파일의 `CORS_ORIGINS`에 프론트엔드 URL 추가
2. 백엔드만 재시작하면 됨 (빌드 불필요)

```bash
docker-compose restart backend
docker-compose logs -f backend
```

### 문제 3: 데이터가 사라짐

**원인**: Docker 볼륨 문제

**해결**:
```bash
# 볼륨 확인
docker volume ls | grep eventer

# 볼륨이 없으면 생성됨
docker-compose up -d

# 데이터 백업 (정기적으로 수행)
docker cp eventer-map-backend:/app/data/eventer.db ./backup/
```

### 문제 4: 빌드가 너무 느림

**원인**: 개발용 볼륨 마운트

**해결**: 프로덕션에서는 볼륨 마운트 제거 고려

`docker-compose.yml`에서 다음 라인 주석 처리:
```yaml
# volumes:
#   - ./backend:/app  # 개발용, 프로덕션에서는 제거 가능
```

---

## 📊 성능 최적화 (선택)

### 1. PostgreSQL 전환

대용량 데이터 처리 시 SQLite → PostgreSQL 전환 권장

### 2. Nginx 리버스 프록시

하나의 도메인으로 백엔드/프론트엔드 통합:
- `https://yourdomain.com` → 프론트엔드
- `https://yourdomain.com/api` → 백엔드

### 3. HTTPS 설정

Let's Encrypt 인증서 적용:
- Synology DSM의 "인증서" 메뉴 활용
- 또는 Nginx에서 직접 설정

---

## 🔄 업데이트 방법

### 코드 변경 후 재배포

```bash
# 1. 코드 업데이트 (Git 사용 시)
git pull

# 2. 재빌드 및 재시작
docker-compose down
docker-compose build
docker-compose up -d

# 3. 로그 확인
docker-compose logs -f
```

### 환경 변수만 변경 시

```bash
# .env 파일 수정 후
docker-compose down
docker-compose up -d
```

---

## 📝 백업 전략

### 데이터베이스 백업

```bash
# 수동 백업
docker cp eventer-map-backend:/app/data/eventer.db ./backup/eventer-$(date +%Y%m%d).db

# Cron으로 자동 백업 (매일 새벽 3시)
0 3 * * * docker cp eventer-map-backend:/app/data/eventer.db /volume1/backup/eventer-$(date +\%Y\%m\%d).db
```

### 전체 프로젝트 백업

```bash
# 볼륨 백업
docker run --rm -v eventer-map_backend-data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/backend-data.tar.gz -C /data .
```

---

## 📚 관련 문서

- [프로젝트 개요](./PROJECT_OVERVIEW.md)
- [현재 상태](./CURRENT_STATUS.md)
- [개발 일지](./logs/2025/11-November.md)
- [메인 README](../README.md)

---

**🎉 배포 성공!** 문제가 발생하면 로그를 확인하고 트러블슈팅 섹션을 참고하세요.
