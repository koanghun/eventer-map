# 인프라 및 배포 결정

> Docker, Nginx, Synology NAS 배포에 관한 결정사항

---

## Q: Docker를 왜 사용하나요?

**결정**: Docker + Docker Compose 사용

**이유**:
- **일관된 환경**: 개발/배포 환경 동일
- **Synology NAS 호환**: NAS Docker 패키지 완벽 지원
- **간편한 배포**: `docker-compose up -d`로 원클릭 배포
- **격리**: 의존성 충돌 방지
- **이식성**: 다른 서버로 쉽게 이전 가능

**구성**:
```yaml
services:
  backend:   # FastAPI
  frontend:  # React (Nginx)
```

**대안**: 직접 설치, Kubernetes
- **직접 설치**: 환경 불일치 위험, 의존성 관리 복잡
- **Kubernetes**: 과도한 복잡도, 소규모 프로젝트에 부적합

**결과/영향**:
- 배포 시간 단축 (10분 → 1분)
- 환경 문제로 인한 버그 감소
- 팀원 온보딩 간소화

**날짜**: 2025-11-21

---

## Q: 프론트엔드 Dockerfile Multi-stage Build 이유?

**결정**: Multi-stage build 사용

**이유**:
- **빌드 스테이지**: Node.js로 React 앱 빌드
- **프로덕션 스테이지**: Nginx-alpine으로 정적 파일만 서빙
- **이미지 크기 최소화**: Node.js 불필요한 의존성 제거
- **보안**: 프로덕션 이미지에 빌드 도구 미포함

**Dockerfile 구조**:
```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

**결과**:
- 최종 이미지 크기: ~50MB (Single-stage: ~1GB)
- 보안 향상 (build tool 제외)
- 배포 속도 향상

**날짜**: 2025-11-21

---

## Q: Nginx를 왜 사용하나요?

**결정**: Nginx를 프론트엔드 서버로 사용

**이유**:
- **정적 파일 서빙**: React 빌드 결과물 효율적 제공
- **리버스 프록시**: `/api` 경로를 백엔드로 프록시
- **SPA 라우팅**: `try_files`로 React Router 지원
- **성능**: Gzip 압축, 캐싱 설정
- **경량**: Alpine 이미지 사용

**Nginx 설정 핵심**:
```nginx
# SPA 라우팅
location / {
    try_files $uri $uri/ /index.html;
}

# API 프록시
location /api {
    proxy_pass http://backend:8000;
}

# 정적 파일 캐싱
location ~* \.(jpg|css|js)$ {
    expires 1y;
}
```

**대안**: serve, http-server
- 프로덕션 환경에 부적합
- 캐싱/압축 설정 제한적

**결과/영향**:
- 정적 파일 서빙 속도 향상
- CORS 문제 해결 (프록시)
- SPA 라우팅 자동 처리

**날짜**: 2025-11-21

---

## Q: Synology NAS 배포 전략은?

**결정**: Docker Compose + SSH 배포

**배포 순서**:
1. Synology NAS SSH 활성화
2. 프로젝트 파일을 NAS에 복사 (rsync 또는 Git clone)
3. `docker-compose up -d --build` 실행
4. 포트 포워딩 또는 역프록시 설정

**디렉토리 구조**:
```
/volume1/docker/eventer-map/
├── backend/
├── frontend/
├── docker-compose.yml
└── .env
```

**보안 고려사항**:
- Google Maps API 키에 도메인/IP 제한 설정
- HTTPS 사용 (Let's Encrypt)
- 환경 변수로 민감 정보 관리
- 방화벽 설정

**향후 개선**:
- GitHub Actions로 자동 배포
- 헬스 체크 및 모니터링
- 자동 백업 스크립트

**날짜**: 2025-11-21

---

## Q: 환경 변수 관리 전략은?

**결정**: `.env` 파일 + `.env.example` 템플릿

**구조**:
```
backend/.env.example  # 템플릿
backend/.env          # 실제 값 (gitignore)

frontend/.env.example # 템플릿
frontend/.env         # 실제 값 (gitignore)
```

**이유**:
- 민감 정보 Git 커밋 방지
- 팀원에게 필요한 환경 변수 안내
- 배포 환경별로 다른 값 사용 가능

**주요 환경 변수**:
```bash
# Backend
DATABASE_URL=sqlite:///./data/eventer.db
CORS_ORIGINS=http://localhost:3000

# Frontend
REACT_APP_API_URL=http://localhost:8000
REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_KEY
```

**날짜**: 2025-11-21
