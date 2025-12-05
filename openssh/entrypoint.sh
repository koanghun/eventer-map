#!/bin/bash
set -e

echo "==================================="
echo "SSH 컨테이너 시작 중..."
echo "==================================="

# 1. 비밀번호 설정 (환경 변수에서 가져옴, 기본값: changeme)
echo "developer:${USER_PASSWORD:-changeme}" | chpasswd
echo "✓ 사용자 비밀번호 설정 완료"

# 2. SSH 공개키 설정 (있는 경우)
if [ -n "$PUBLIC_KEY" ]; then
    echo "$PUBLIC_KEY" > /home/developer/.ssh/authorized_keys
    chmod 600 /home/developer/.ssh/authorized_keys
    chown developer:developer /home/developer/.ssh/authorized_keys
    echo "✓ SSH 공개키 설정 완료"
else
    echo "ℹ SSH 공개키가 설정되지 않음 (비밀번호 인증 사용)"
fi

# 3. 프로젝트 디렉토리 권한 설정 (있는 경우)
if [ -d "/home/developer/eventer-map" ]; then
    chown -R developer:developer /home/developer/eventer-map
    echo "✓ 프로젝트 디렉토리 권한 설정 완료"
fi

# 4. 홈 디렉토리 권한 확인
chown -R developer:developer /home/developer

echo "==================================="
echo "SSH 서비스 시작"
echo "접속 정보:"
echo "  - 사용자: developer"
echo "  - 포트: 22 (호스트: ${SSH_PORT:-7774})"
echo "==================================="

# SSH 서비스 시작 (foreground)
exec /usr/sbin/sshd -D
