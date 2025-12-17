#!/bin/bash

# ============================================
# SQLite Database Restore Script
# ============================================
# 백업 파일에서 데이터베이스를 복원합니다.
# - 사용 가능한 백업 목록 표시
# - 선택한 백업으로 복원
# - 복원 전 현재 데이터베이스 자동 백업

set -e  # 에러 발생 시 스크립트 중단

# ============================================
# 설정
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
CONTAINER_NAME="eventer-map-backend"
DB_PATH_IN_CONTAINER="/app/data/eventer.db"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# 로그 함수
# ============================================
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# ============================================
# 백업 디렉토리 확인
# ============================================
if [ ! -d "$BACKUP_DIR" ]; then
    log_error "백업 디렉토리가 존재하지 않습니다: $BACKUP_DIR"
    exit 1
fi

# ============================================
# 컨테이너 실행 확인
# ============================================
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_error "백엔드 컨테이너가 실행 중이지 않습니다: $CONTAINER_NAME"
    log_info "다음 명령어로 컨테이너를 시작하세요:"
    log_info "  docker-compose -f docker-compose.pro.yml up -d"
    exit 1
fi

# ============================================
# 백업 파일 목록
# ============================================
echo ""
log "====================================="
log "사용 가능한 백업 파일"
log "====================================="

# 백업 파일을 배열로 저장
mapfile -t BACKUPS < <(find "$BACKUP_DIR" -name "eventer_backup_*.db" -type f -printf "%T@ %p\n" | sort -rn | cut -d' ' -f2-)

if [ ${#BACKUPS[@]} -eq 0 ]; then
    log_error "사용 가능한 백업 파일이 없습니다."
    exit 1
fi

# 백업 목록 출력
for i in "${!BACKUPS[@]}"; do
    BACKUP_FILE="${BACKUPS[$i]}"
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    FILENAME=$(basename "$BACKUP_FILE")
    DATE=$(echo "$FILENAME" | sed 's/eventer_backup_\([0-9]\{8\}\)_\([0-9]\{6\}\).*/\1 \2/' | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\) \([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
    printf "${BLUE}%2d)${NC} %s (%s) - %s\n" $((i+1)) "$FILENAME" "$SIZE" "$DATE"
done

# ============================================
# 백업 선택
# ============================================
echo ""
read -p "복원할 백업 번호를 선택하세요 (1-${#BACKUPS[@]}, 0=취소): " CHOICE

if [ "$CHOICE" = "0" ]; then
    log "복원 작업이 취소되었습니다."
    exit 0
fi

if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt ${#BACKUPS[@]} ]; then
    log_error "잘못된 선택입니다."
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((CHOICE-1))]}"
log_info "선택한 백업: $(basename "$SELECTED_BACKUP")"

# ============================================
# 확인
# ============================================
echo ""
log_warning "경고: 현재 데이터베이스가 선택한 백업으로 교체됩니다."
log_warning "현재 데이터베이스는 자동으로 백업됩니다."
echo ""
read -p "계속하시겠습니까? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "복원 작업이 취소되었습니다."
    exit 0
fi

# ============================================
# 현재 데이터베이스 백업 (복원 전)
# ============================================
echo ""
log "====================================="
log "현재 데이터베이스 백업 중..."
log "====================================="

TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
SAFETY_BACKUP="$BACKUP_DIR/eventer_backup_pre_restore_${TIMESTAMP}.db"

if docker cp "${CONTAINER_NAME}:${DB_PATH_IN_CONTAINER}" "$SAFETY_BACKUP"; then
    BACKUP_SIZE=$(du -h "$SAFETY_BACKUP" | cut -f1)
    log "✓ 현재 DB 백업 완료: $(basename "$SAFETY_BACKUP") ($BACKUP_SIZE)"
else
    log_error "현재 데이터베이스 백업 실패"
    exit 1
fi

# ============================================
# 데이터베이스 복원
# ============================================
echo ""
log "====================================="
log "데이터베이스 복원 중..."
log "====================================="

# 백업 파일을 컨테이너로 복사
if docker cp "$SELECTED_BACKUP" "${CONTAINER_NAME}:${DB_PATH_IN_CONTAINER}"; then
    log "✓ 데이터베이스 복원 완료!"
    log_info "복원된 백업: $(basename "$SELECTED_BACKUP")"
else
    log_error "데이터베이스 복원 실패"
    log_warning "이전 데이터베이스는 다음 위치에 백업되어 있습니다:"
    log_warning "  $SAFETY_BACKUP"
    exit 1
fi

# ============================================
# 컨테이너 재시작
# ============================================
echo ""
log "====================================="
log "백엔드 컨테이너 재시작 중..."
log "====================================="

if docker restart "$CONTAINER_NAME" > /dev/null 2>&1; then
    log "✓ 컨테이너 재시작 완료"
else
    log_warning "컨테이너 재시작 실패. 수동으로 재시작하세요:"
    log_info "  docker restart $CONTAINER_NAME"
fi

# ============================================
# 완료
# ============================================
echo ""
log "====================================="
log "데이터베이스 복원 완료!"
log "====================================="
log_info "복원 전 백업: $(basename "$SAFETY_BACKUP")"
log_info "복원된 백업: $(basename "$SELECTED_BACKUP")"
echo ""
