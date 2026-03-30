# ============================================
# AI 기반 이벤트 추출기 (Event Extractor)
# ============================================
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 설치 (필요시)
# Gmail API 인증 시 웹 브라우저가 필요할 수 있으나, 
# Docker 내에서는 --noauth_local_webserver 옵션 또는 token.json을 미리 마운트하여 사용
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 보안을 위한 non-root 사용자 생성
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

# 애플리케이션 코드 복사
COPY --chown=appuser:appuser . .

# 권한 설정
USER appuser

# 기본 실행 명령 (필요 시 인자를 주어 실행)
# 예: docker run --rm event-extractor python main.py
ENTRYPOINT ["python", "main.py"]
