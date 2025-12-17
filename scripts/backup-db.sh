#!/bin/bash

# ============================================
# SQLite Database Backup Script
# ============================================
# 프로덕션 환경의 SQLite 데이터베이스를 백업합니다.
# - Docker 볼륨에서 데이터베이스 복사
# - 타임스탬프가 포함된 백업 파일 생성
# - 10일 이상 된 백업 자동 삭제

set -e  # 에러 발생 시 스크립트 중단

# ============================================
# 설정
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
CONTAINER_NAME="eventer-map-backend"
DB_PATH_IN_CONTAINER="/app/data/eventer.db"
RETENTION_DAYS=10

# 로그 파일
LOG_FILE="$BACKUP_DIR/backup.log"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================
# 로그 함수
# ============================================
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

# ============================================
# 백업 디렉토리 확인/생성
# ============================================
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    log "백업 디렉토리 생성: $BACKUP_DIR"
fi

# ============================================
# 컨테이너 실행 확인
# ============================================
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_error "백엔드 컨테이너가 실행 중이지 않습니다: $CONTAINER_NAME"
    exit 1
fi

# ============================================
# 백업 파일명 생성 (타임스탬프 포함)
# ============================================
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/eventer_backup_${TIMESTAMP}.db"

# ============================================
# 데이터베이스 백업
# ============================================
log "====================================="
log "데이터베이스 백업 시작"
log "====================================="
log "컨테이너: $CONTAINER_NAME"
log "백업 파일: $BACKUP_FILE"

# Docker 컨테이너에서 데이터베이스 파일 복사
if docker cp "${CONTAINER_NAME}:${DB_PATH_IN_CONTAINER}" "$BACKUP_FILE"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "✓ 백업 완료: $BACKUP_FILE ($BACKUP_SIZE)"
else
    log_error "백업 실패"
    exit 1
fi

# ============================================
# 오래된 백업 삭제 (10일 이상)
# ============================================
log "====================================="
log "오래된 백업 정리 중 (${RETENTION_DAYS}일 이상)"
log "====================================="

# 10일 이상 된 백업 파일 찾기 및 삭제
DELETED_COUNT=0
while IFS= read -r old_backup; do
    if [ -f "$old_backup" ]; then
        BACKUP_DATE=$(basename "$old_backup" | sed 's/eventer_backup_\([0-9]\{8\}\).*/\1/')
        rm -f "$old_backup"
        log "✓ 삭제됨: $(basename "$old_backup") (날짜: $BACKUP_DATE)"
        ((DELETED_COUNT++))
    fi
done < <(find "$BACKUP_DIR" -name "eventer_backup_*.db" -type f -mtime +$RETENTION_DAYS)

if [ $DELETED_COUNT -eq 0 ]; then
    log "정리할 오래된 백업이 없습니다."
else
    log "총 ${DELETED_COUNT}개의 오래된 백업 삭제됨"
fi

# ============================================
# 현재 백업 목록
# ============================================
log "====================================="
log "현재 백업 파일 목록"
log "====================================="

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "eventer_backup_*.db" -type f | wc -l)
log "총 백업 개수: $BACKUP_COUNT"

if [ $BACKUP_COUNT -gt 0 ]; then
    find "$BACKUP_DIR" -name "eventer_backup_*.db" -type f -printf "%T@ %p\n" | \
    sort -rn | \
    head -5 | \
    while read -r timestamp filepath; do
        SIZE=$(du -h "$filepath" | cut -f1)
        FILENAME=$(basename "$filepath")
        DATE=$(echo "$FILENAME" | sed 's/eventer_backup_\([0-9]\{8\}\)_\([0-9]\{6\}\).*/\1 \2/' | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\) \([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
        log "  - $FILENAME ($SIZE) - $DATE"
    done
fi

log "====================================="
log "백업 완료!"
log "====================================="
