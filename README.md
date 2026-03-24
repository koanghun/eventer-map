# Event Map Application

이벤트 정보를 지도에 표시하는 웹 애플리케이션입니다. 사용자는 이벤트를 등록하고, 날짜를 선택하여 해당 날짜의 이벤트들을 Google Map에서 확인할 수 있습니다.

## 기술 스택

### 백엔드
- **Python 3.11**
- **FastAPI**: 고성능 비동기 웹 프레임워크
- **Uvicorn**: ASGI 서버
- **SQLAlchemy**: ORM
- **PostgreSQL**: 데이터베이스

### 프론트엔드
- **React 18**
- **TypeScript**: 타입 안정성
- **Google Maps API**: 지도 및 위치 서비스
- **Axios**: HTTP 클라이언트
- **date-fns**: 날짜 처리

### 인프라
- **Docker & Docker Compose**: 컨테이너화
- **Nginx**: 프론트엔드 서빙 및 리버스 프록시
- **Synology NAS**: 배포 환경

## 주요 기능

- ✅ 이벤트 등록/수정/삭제 (CRUD)
- ✅ 날짜별 이벤트 필터링
- ✅ Google Maps에 이벤트 마커 표시
- ✅ 이벤트 상세 정보 (개최일, 시간, 장소, 출연자, 관련 링크)
- ✅ Google Maps API 최적화 (최소 사용량)

## 프로젝트 구조

```
eventer-map/
├── backend/              # FastAPI 백엔드
│   ├── routes/          # API 라우트
│   ├── models.py        # 데이터베이스 모델
│   ├── schemas.py       # Pydantic 스키마
│   ├── database.py      # DB 연결 설정
│   ├── main.py          # FastAPI 앱
│   ├── requirements.txt # Python 의존성
│   └── Dockerfile       # 백엔드 Docker 이미지
├── frontend/            # React 프론트엔드
│   ├── src/
│   │   ├── components/  # React 컴포넌트
│   │   ├── services/    # API 클라이언트
│   │   ├── types/       # TypeScript 타입
│   │   └── App.tsx      # 메인 앱
│   ├── package.json     # Node 의존성
│   ├── nginx.conf       # Nginx 설정
│   └── Dockerfile       # 프론트엔드 Docker 이미지
└── docker-compose.yml   # Docker Compose 설정
```

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- Google Maps API 키

### 1. Google Maps API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. Maps JavaScript API 활성화
3. Geocoding API 활성화 (주소 → 좌표 변환용)
4. API 키 생성 및 제한 설정

### 2. 환경 변수 설정

```bash
# 백엔드 환경 변수
cp backend/.env.example backend/.env
# backend/.env 파일 편집

# 프론트엔드 환경 변수
cp frontend/.env.example frontend/.env
# frontend/.env 파일에 Google Maps API 키 추가
```

### 3. 실행 (WSL 환경)

```bash
# Docker Compose로 전체 스택 실행
docker-compose up --build

# 백그라운드 실행
docker-compose up -d --build
```

애플리케이션이 실행되면:
- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:8000
- API 문서: http://localhost:8000/docs

### 4. 개발 모드 (WSL)

백엔드와 프론트엔드를 개별적으로 실행할 수도 있습니다.

```bash
# 백엔드 개발 서버
cd backend
python -m venv venv
source venv/bin/activate  # WSL/Linux
.\venv\Scripts\Activate.ps1  # Windows PowerShell
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드 개발 서버 (새 터미널)
cd frontend
npm install --legacy-peer-deps
npm start
```

## Synology NAS 배포

### Docker를 통한 배포

1. Synology NAS에 SSH 접속
2. 프로젝트 파일을 NAS에 복사
3. Docker Compose 실행

```bash
# NAS에서 실행
cd /volume1/docker/eventer-map
docker-compose up -d --build
```

### 포트 포워딩 설정

- 라우터에서 외부 포트를 NAS IP:3000으로 포워딩
- 또는 역프록시(Nginx Proxy Manager 등) 사용

### 보안 권장사항

- Google Maps API 키에 도메인/IP 제한 설정
- HTTPS 사용 (Let's Encrypt)
- 환경 변수로 민감 정보 관리

## Google Maps API 최적화

자택 환경에서 API 비용을 최소화하기 위한 전략:

1. **Geocoding 캐싱**: 이벤트 등록 시 주소를 좌표로 변환하여 DB 저장
2. **정적 마커**: 런타임에 불필요한 API 호출 방지
3. **지도 재사용**: 한 번 로드한 지도 인스턴스 재사용
4. **API 키 제한**: 특정 도메인/IP만 허용

## API 엔드포인트

- `POST /events`: 이벤트 생성
- `GET /events`: 모든 이벤트 조회
- `GET /events/{id}`: 특정 이벤트 조회
- `PUT /events/{id}`: 이벤트 수정
- `DELETE /events/{id}`: 이벤트 삭제
- `GET /events/by-date/{date}`: 특정 날짜의 이벤트 조회

## 라이선스

MIT
