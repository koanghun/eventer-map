#!/bin/bash
set -e

echo "===================================="
echo "Frontend 컨테이너 시작 중..."
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
echo "React 개발 서버 시작"
echo "  - 주소: http://0.0.0.0:3000"
echo "  - Hot Reload: 활성화"
echo "  - 로그: stdout/stderr로 출력"
echo "===================================="

# 5. React 개발 서버 시작 (developer 사용자로)
cd /app

# npm install을 먼저 실행 (로그 출력)
su developer -c "npm install --legacy-peer-deps" 2>&1

# React 개발 서버 시작 (stdout/stderr를 명시적으로 유지)
# exec를 사용하여 프로세스를 교체하고 로그 스트림 유지
exec su developer -c "exec npm start" 2>&1
