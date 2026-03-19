#!/bin/bash
set -e

echo "===================================="
echo "Backend 컨테이너 시작 중..."
echo "===================================="

# 1. 애플리케이션 디렉토리 권한 설정 (개발 편의를 위해 유지)
chown -R developer:developer /app 2>/dev/null || true


# 5. 데이터베이스 마이그레이션 실행
echo "===================================="
echo "데이터베이스 마이그레이션 실행 중..."
echo "===================================="

cd /app
# Python 버퍼링 비활성화 + stdout/stderr 통합으로 로그 즉시 출력
python -u -m alembic -c /app/alembic.ini upgrade head 2>&1

if [ $? -eq 0 ]; then
    echo "✓ 마이그레이션 완료"
else
    echo "⚠ 마이그레이션 실패 (서버는 계속 시작됩니다)"
fi

echo "===================================="
echo "FastAPI 서버 시작"
echo "  - 주소: http://0.0.0.0:8000"
echo "  - Hot Reload: 활성화"
echo "  - 로그: stdout/stderr로 출력"
echo "===================================="

# 6. FastAPI 서버 시작 (developer 사용자로, 환경변수 유지)
# Python 버퍼링 비활성화 (-u): 로그가 즉시 Docker로 전달됨
# --log-level info: 상세한 로그 출력
# --access-log: HTTP 요청 로그 활성화
# 2>&1: stderr도 stdout으로 리다이렉션하여 모든 로그 통합
exec setpriv --reuid=developer --regid=developer --clear-groups \
    env PYTHONUNBUFFERED=1 python -u -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 \
    --log-level info --access-log 2>&1
