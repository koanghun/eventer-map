# ============================================
# 1단계: 빌드 스테이지 (의존성 설치)
# ============================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Python 의존성 설치 (전역으로 설치)
# --user 플래그 없이 설치하면 /usr/local에 설치됨
# 이렇게 하면 non-root 사용자도 접근 가능
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# 2단계: 프로덕션 스테이지 (실행 환경)
# ============================================
FROM python:3.11-slim

WORKDIR /app

# 빌드 스테이지에서 설치한 Python 패키지 복사
# site-packages: 설치된 라이브러리들
# bin: uvicorn, fastapi 등 실행 파일들
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 헬스체크에 필요한 curl 설치
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 보안을 위한 non-root 사용자 생성
# UID 1000: 대부분의 리눅스 시스템에서 첫 번째 일반 사용자 UID
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app

# 애플리케이션 코드 복사 (appuser 소유로)
COPY --chown=appuser:appuser . .

# 데이터 디렉토리 권한 설정 (Docker 볼륨 마운트를 위해)
# 755: 소유자는 읽기/쓰기/실행, 그룹과 기타는 읽기/실행
RUN chmod 755 /app/data

# non-root 사용자로 전환
# 이후 모든 명령은 appuser 권한으로 실행
USER appuser

# 포트 노출 (문서화 목적, 실제 포트는 docker-compose.yml에서 매핑)
EXPOSE 8000

# 헬스체크 설정
# Docker가 주기적으로 실행하여 컨테이너 상태 확인
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 애플리케이션 실행
# uvicorn: ASGI 서버
# --host 0.0.0.0: 모든 네트워크 인터페이스에서 접속 허용
# --port 8000: 8000번 포트에서 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
