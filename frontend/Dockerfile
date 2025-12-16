# ============================================
# 1단계: 빌드 스테이지 (React 앱 빌드)
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# package.json과 package-lock.json 복사
# 이 파일들만 먼저 복사하여 Docker 레이어 캐싱 최적화
# 의존성이 변경되지 않으면 이 레이어를 재사용 가능
COPY package*.json ./

# 의존성 설치
# --legacy-peer-deps: TypeScript 5.x와 react-scripts 5.0.1 호환성 문제 해결
# npm ci: package-lock.json을 기반으로 정확한 버전 설치 (재현 가능한 빌드)
RUN npm ci --legacy-peer-deps

# 소스 코드 복사
COPY . .

# 빌드 인자 (docker-compose.yml에서 전달)
# 이 환경 변수들은 React 빌드 시 코드에 포함됨
ARG REACT_APP_API_URL
ARG REACT_APP_GOOGLE_MAPS_API_KEY

# React 앱 빌드
# 결과물은 /app/build 디렉토리에 생성됨
# HTML, CSS, JS 파일들이 최적화되어 생성됨
RUN npm run build

# ============================================
# 2단계: 프로덕션 스테이지 (nginx로 서빙)
# ============================================
FROM nginx:alpine

# wget 설치 (헬스체크용)
RUN apk add --no-cache wget

# 빌드된 React 앱을 nginx 웹 루트로 복사
# nginx는 /usr/share/nginx/html의 파일들을 서빙함
COPY --from=builder /app/build /usr/share/nginx/html

# nginx 설정 파일 복사
# SPA 라우팅, API 프록시, 보안 헤더 등 설정 포함
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 포트 노출 (nginx 기본 HTTP 포트)
EXPOSE 80

# 헬스체크: nginx가 정상 작동하는지 확인
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# nginx 실행
# -g "daemon off;": foreground에서 실행 (Docker 컨테이너 유지를 위해)
CMD ["nginx", "-g", "daemon off;"]
