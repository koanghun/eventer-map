#!/bin/bash
set -e

echo "===================================="
echo "Frontend 컨테이너 시작 중..."
echo "===================================="

# 1. 애플리케이션 디렉토리 권한 설정 (개발 편의를 위해 유지)
chown -R node:node /app 2>/dev/null || true


echo "===================================="
echo "React 개발 서버 시작"
echo "  - 주소: http://0.0.0.0:3000"
echo "  - Hot Reload: 활성화"
echo "  - 로그: stdout/stderr로 출력"
echo "===================================="

# 5. React 개발 서버 시작 (node 사용자로)
cd /app

# npm install을 먼저 실행 (로그 출력)
su node -c "npm install --legacy-peer-deps" 2>&1

# React 개발 서버 시작 (stdout/stderr를 명시적으로 유지)
# exec를 사용하여 프로세스를 교체하고 로그 스트림 유지
exec su node -c "exec npm start" 2>&1
