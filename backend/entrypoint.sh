#!/bin/bash
set -e

echo "===================================="
echo "Backend 컨테이너 시작 중..."
echo "===================================="

# 1. SSH 비밀번호 설정
if [ -n "$USER_PASSWORD" ]; then
    echo "developer:$USER_PASSWORD" | chpasswd
    echo "✓ 사용자 비밀번호 설정 완료"
fi

# 2. SSH 공개키 설정 (있는 경우)
if [ -n "$PUBLIC_KEY" ]; then
    echo "$PUBLIC_KEY" > /home/developer/.ssh/authorized_keys
    chmod 600 /home/developer/.ssh/authorized_keys
    chown developer:developer /home/developer/.ssh/authorized_keys
    echo "✓ SSH 공개키 설정 완료"
else
    echo "ℹ SSH 공개키가 설정되지 않음 (비밀번호 인증 사용)"
fi

# 3. 애플리케이션 디렉토리 권한 설정
chown -R developer:developer /app 2>/dev/null || true

# 4. SSH 서버 시작 (백그라운드)
/usr/sbin/sshd
echo "✓ SSH 서버 시작됨 (포트 22)"

echo "===================================="
echo "FastAPI 서버 시작"
echo "  - 주소: http://0.0.0.0:8000"
echo "  - Hot Reload: 활성화"
echo "===================================="

# 5. FastAPI 서버 시작 (developer 사용자로, 환경변수 유지)
cd /app
exec setpriv --reuid=developer --regid=developer --clear-groups \
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
