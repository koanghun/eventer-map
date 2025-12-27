#!/bin/bash

##############################################
# MyDNS.jp IP 자동 업데이트 스크립트 (IPv4 + IPv6)
##############################################
# 이 스크립트는 현재 서버의 IPv4와 IPv6 주소를 MyDNS.jp에 주기적으로 알려줍니다.
# IPv4와 IPv6를 모두 업데이트하여 다양한 환경에서 접속 가능하도록 합니다.
# Synology 작업 스케줄러에서 매일 실행하도록 설정하세요.
#
# 작성일: 2025-12-25
# 수정일: 2025-12-26 (IPv4 + IPv6 듀얼 스택으로 변경)
##############################################

# 설정 (여기에 실제 정보 입력)
MYDNS_MASTER_ID="mydns786724"
MYDNS_PASSWORD="YOUR_PASSWORD_HERE"  # ⚠️ 반드시 실제 비밀번호로 변경하세요!

# 로그 파일 설정
LOG_DIR="/volume2/docker/eventer-map/logs"
LOG_FILE="$LOG_DIR/mydns_update.log"

# 로그 디렉토리 생성 (없으면)
mkdir -p "$LOG_DIR"

# 로그 함수
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 시작 로그
log "=========================================="
log "MyDNS IP 업데이트 시작 (IPv4 + IPv6)"

# 현재 IPv4 주소 확인
CURRENT_IPV4=$(curl -s https://api.ipify.org)
if [ -z "$CURRENT_IPV4" ]; then
    log "⚠️ 경고: IPv4 주소를 찾을 수 없습니다"
    CURRENT_IPV4="없음"
else
    log "현재 IPv4 주소: $CURRENT_IPV4"
fi

# 현재 IPv6 주소 확인 (scope global만)
CURRENT_IPV6=$(ip -6 addr show scope global | grep inet6 | awk '{print $2}' | cut -d/ -f1 | head -1)
if [ -z "$CURRENT_IPV6" ]; then
    log "⚠️ 경고: IPv6 주소를 찾을 수 없습니다"
    CURRENT_IPV6="없음"
else
    log "현재 IPv6 주소: $CURRENT_IPV6"
fi

# MyDNS.jp에 IPv4 주소 업데이트
log "MyDNS.jp에 IPv4 주소 업데이트 중..."
RESPONSE_IPV4=$(curl -s -u "$MYDNS_MASTER_ID:$MYDNS_PASSWORD" "https://ipv4.mydns.jp/login.html")

if [ $? -eq 0 ]; then
    log "✅ IPv4 업데이트 성공!"
    log "IPv4 응답: $RESPONSE_IPV4"
else
    log "❌ IPv4 업데이트 실패 (curl 에러)"
    log "IPv4 응답: $RESPONSE_IPV4"
fi

# MyDNS.jp에 IPv6 주소 업데이트
log "MyDNS.jp에 IPv6 주소 업데이트 중..."
RESPONSE_IPV6=$(curl -s -u "$MYDNS_MASTER_ID:$MYDNS_PASSWORD" "https://ipv6.mydns.jp/login.html")

if [ $? -eq 0 ]; then
    log "✅ IPv6 업데이트 성공!"
    log "IPv6 응답: $RESPONSE_IPV6"
else
    log "❌ IPv6 업데이트 실패 (curl 에러)"
    log "IPv6 응답: $RESPONSE_IPV6"
fi

log "=========================================="

# 로그 파일 크기 제한 (최근 1000줄만 유지)
if [ -f "$LOG_FILE" ]; then
    tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp"
    mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

exit 0
