# 환경 변수 설정 가이드

eventer-map 프로젝트의 환경 변수 설정에 대한 상세 가이드입니다.

## 환경 변수 파일 구조

프로젝트는 다음 환경 변수 파일들을 사용합니다:

- `.env.example` - 예시 템플릿 (개발 환경용)
- `.env.production` - 프로덕션 템플릿 (시놀로지 NAS 배포용)
- `.env` - 실제 사용되는 환경 변수 (Git에서 제외됨)

## 빠른 설정

### 시놀로지 NAS 배포

```bash
# 프로젝트 루트에서 실행
cp .env.production .env

# 편집기로 .env 파일 열기
vi .env  # 또는 nano .env
```

### 개발 환경

```bash
# 프로젝트 루트에서 실행
cp .env.example .env

# 편집기로 .env 파일 열기
vi .env  # 또는 nano .env
```

## 환경 변수 상세 설명

### Backend 환경 변수

#### `DATABASE_URL`

**설명**: 데이터베이스 연결 문자열

**기본값**: `sqlite:///./data/eventer.db`

**예시**:
```bash
# SQLite (기본, 권장)
DATABASE_URL=sqlite:///./data/eventer.db

# PostgreSQL (고급 사용자)
DATABASE_URL=postgresql://user:password@localhost/eventer_db
```

**참고**: 
- SQLite는 별도 설정 없이 사용 가능
- 데이터는 Docker 볼륨 `backend-data`에 저장됨
- PostgreSQL 사용 시 추가 설정 필요

---

#### `CORS_ORIGINS`

**설명**: CORS(Cross-Origin Resource Sharing) 허용 출처 목록

**기본값**: `http://localhost:3000,http://localhost`

**형식**: 쉼표로 구분된 URL 목록 (공백 없이)

**시놀로지 NAS 예시**:
```bash
# NAS IP 사용
CORS_ORIGINS=http://192.168.1.100:3000,http://192.168.1.100

# 도메인 사용
CORS_ORIGINS=https://eventer.yourdomain.com,https://www.eventer.yourdomain.com

# 혼용 (개발 + 프로덕션)
CORS_ORIGINS=http://192.168.1.100:3000,http://localhost:3000,http://localhost
```

> [!IMPORTANT]
> 프론트엔드가 접근하는 모든 주소를 포함해야 합니다!

**보안 주의사항**:
- 와일드카드(`*`) 사용은 보안상 권장하지 않음
- 프로덕션에서는 정확한 도메인/IP만 명시

---

### Frontend 환경 변수

#### `REACT_APP_API_URL`

**설명**: 백엔드 API 기본 URL

**기본값**: `http://localhost:8000`

**시놀로지 NAS 예시**:
```bash
# NAS IP 사용
REACT_APP_API_URL=http://192.168.1.100:8000

# 도메인 사용
REACT_APP_API_URL=https://api.eventer.yourdomain.com

# 로컬 개발
REACT_APP_API_URL=http://localhost:8000
```

> [!NOTE]
> 프로덕션 빌드 시에는 nginx가 `/api`를 `http://backend:8000`으로 프록시하므로 이 값은 빌드 시에만 사용됩니다.

---

#### `REACT_APP_GOOGLE_MAPS_API_KEY`

**설명**: Google Maps JavaScript API 키

**필수**: ✅ 예 (지도 기능에 필수)

**발급 방법**: [Google Cloud Console](https://console.cloud.google.com/)

**예시**:
```bash
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSyC1234567890abcdefGHIJKLMNOPQRSTUVW
```

**보안 설정 (필수)**:

1. **HTTP 리퍼러 제한**:
   ```
   http://192.168.1.100:3000/*
   http://localhost:3000/*
   ```

2. **API 제한**:
   - Maps JavaScript API
   - Geocoding API

> [!WARNING]
> API 키를 제한하지 않으면 무단 사용으로 인한 과금이 발생할 수 있습니다!

**발급 단계**:
1. Google Cloud Console 프로젝트 생성
2. Maps JavaScript API 활성화
3. Geocoding API 활성화
4. API 키 생성
5. 리퍼러 및 API 제한 설정

자세한 내용은 [`docs/SYNOLOGY_DEPLOYMENT.md`](../docs/SYNOLOGY_DEPLOYMENT.md#google-maps-api-키-발급) 참조.

---

### Docker Compose 환경 변수

#### `BACKEND_PORT`

**설명**: 백엔드 서비스 외부 포트

**기본값**: `8000`

**예시**:
```bash
# 기본 포트
BACKEND_PORT=8000

# 충돌 시 변경
BACKEND_PORT=8001
```

---

#### `FRONTEND_PORT`

**설명**: 프론트엔드 서비스 외부 포트

**기본값**: `3000`

**예시**:
```bash
# 기본 포트
FRONTEND_PORT=3000

# 충돌 시 변경
FRONTEND_PORT=8080
```

> [!NOTE]
> 컨테이너 내부 포트는 변경되지 않으며, 외부에서 접근하는 포트만 변경됩니다.

---

## 환경별 설정 예시

### 개발 환경 (로컬)

```bash
# Database
DATABASE_URL=sqlite:///./data/eventer.db

# CORS (개발 모드, 모든 localhost 허용)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost

# Frontend
REACT_APP_API_URL=http://localhost:8000
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSy...your-dev-key

# Ports
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

### 프로덕션 환경 (시놀로지 NAS - IP)

```bash
# Database
DATABASE_URL=sqlite:///./data/eventer.db

# CORS (실제 NAS IP)
CORS_ORIGINS=http://192.168.1.100:3000,http://192.168.1.100

# Frontend
REACT_APP_API_URL=http://192.168.1.100:8000
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSy...your-production-key

# Ports
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

### 프로덕션 환경 (도메인 + HTTPS)

```bash
# Database
DATABASE_URL=sqlite:///./data/eventer.db

# CORS (도메인)
CORS_ORIGINS=https://eventer.yourdomain.com,https://www.eventer.yourdomain.com

# Frontend
REACT_APP_API_URL=https://api.eventer.yourdomain.com
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSy...your-production-key

# Ports (역방향 프록시 사용 시)
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

---

## 환경 변수 적용

### 변경 사항 반영

환경 변수를 변경한 후에는 컨테이너를 재시작해야 합니다:

```bash
# 전체 재시작
sudo docker-compose down
sudo docker-compose up -d

# 특정 서비스만 재시작
sudo docker-compose restart backend
sudo docker-compose restart frontend
```

### 빌드 타임 vs 런타임 변수

- **빌드 타임**: `REACT_APP_*` 변수들은 이미지 빌드 시 적용
  - 변경 시 재빌드 필요: `docker-compose up -d --build`
  
- **런타임**: `DATABASE_URL`, `CORS_ORIGINS` 등은 컨테이너 실행 시 적용
  - 변경 시 재시작만 필요: `docker-compose restart`

---

## 환경 변수 검증

### 올바른 설정 확인

```bash
# .env 파일 내용 확인
cat .env

# Docker Compose가 인식하는 환경 변수 확인
sudo docker-compose config

# 실행 중인 컨테이너의 환경 변수 확인
sudo docker exec eventer-map-backend env | grep -E "DATABASE|CORS"
sudo docker exec eventer-map-frontend env | grep REACT_APP
```

### 체크리스트

배포 전 다음 사항을 확인하세요:

- [ ] `.env` 파일이 프로젝트 루트에 존재
- [ ] `CORS_ORIGINS`에 실제 접근 주소 포함
- [ ] `REACT_APP_GOOGLE_MAPS_API_KEY`가 실제 API 키로 설정됨
- [ ] Google Maps API 키에 리퍼러 제한 설정됨
- [ ] 포트 번호 충돌 확인
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있음 (보안)

---

## 보안 주의사항

### 1. `.env` 파일 관리

```bash
# .env 파일은 절대 Git에 커밋하지 마세요!
# .gitignore에 포함되어 있는지 확인:
cat .gitignore | grep .env
```

### 2. API 키 보호

- Google Maps API 키는 반드시 리퍼러 제한 설정
- 공개 저장소에 API 키 노출 금지
- 정기적으로 API 사용량 모니터링

### 3. CORS 설정

- 프로덕션에서는 정확한 도메인만 허용
- `*` (모든 출처 허용)은 절대 사용 금지

---

## 문제 해결

### 환경 변수가 적용되지 않음

1. `.env` 파일 위치 확인 (프로젝트 루트)
2. 파일 형식 확인 (UTF-8 인코딩)
3. 변수 이름 확인 (대소문자 구분)
4. 재빌드 시도: `docker-compose up -d --build --force-recreate`

### CORS 오류

브라우저 콘솔에 CORS 오류가 표시되면:

1. `CORS_ORIGINS`에 현재 접근 URL이 포함되어 있는지 확인
2. 프로토콜(http/https) 일치 확인
3. 포트 번호 포함 여부 확인
4. 백엔드 재시작: `docker-compose restart backend`

### Google Maps 로드 실패

1. API 키 확인: 올바르게 설정되었는지
2. API 활성화: Maps JavaScript API, Geocoding API
3. 할당량 확인: Google Cloud Console에서 사용량 확인
4. 리퍼러 설정: 현재 도메인/IP가 허용 목록에 있는지

---

## 참고 자료

- [Docker Compose 환경 변수 문서](https://docs.docker.com/compose/environment-variables/)
- [Google Maps API 문서](https://developers.google.com/maps/documentation/javascript)
- [FastAPI 환경 변수 설정](https://fastapi.tiangolo.com/advanced/settings/)
- [Create React App 환경 변수](https://create-react-app.dev/docs/adding-custom-environment-variables/)
