#!/bin/bash

##############################################
# MyDNS.jp IP 자동 업데이트 스크립트
##############################################
# 이 스크립트는 현재 서버의 공인 IP를 MyDNS.jp에 주기적으로 알려줍니다.
# Synology 작업 스케줄러에서 매일 실행하도록 설정하세요.
#
# 작성일: 2025-12-25
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
log "MyDNS IP 업데이트 시작"

# 현재 공인 IP 확인 (참고용)
CURRENT_IP=$(curl -s https://api.ipify.org)
log "현재 공인 IP: $CURRENT_IP"

# MyDNS.jp에 IP 업데이트 (IPv4 전용)
log "MyDNS.jp에 IP 주소 업데이트 중..."

RESPONSE=$(curl -s -u "$MYDNS_MASTER_ID:$MYDNS_PASSWORD" "https://ipv4.mydns.jp/login.html")

# 결과 확인
if [ $? -eq 0 ]; then
    log "✅ 업데이트 성공!"
    log "응답: $RESPONSE"
else
    log "❌ 업데이트 실패 (curl 에러)"
    log "응답: $RESPONSE"
fi

log "=========================================="

# 로그 파일 크기 제한 (최근 1000줄만 유지)
if [ -f "$LOG_FILE" ]; then
    tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp"
    mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

exit 0
