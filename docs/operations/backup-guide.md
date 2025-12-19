# Database Backup & Restore Guide

프로덕션 환경의 SQLite 데이터베이스를 백업하고 복원하는 방법을 안내합니다.

## 📋 목차

- [백업 시스템 개요](#백업-시스템-개요)
- [수동 백업](#수동-백업)
- [자동 백업 설정](#자동-백업-설정-cron)
- [데이터베이스 복원](#데이터베이스-복원)
- [백업 파일 관리](#백업-파일-관리)
- [문제 해결](#문제-해결)

---

## 백업 시스템 개요

### 백업 정책

- **백업 위치**: `./backups/` 디렉토리
- **백업 파일명**: `eventer_backup_YYYYMMDD_HHMMSS.db`
- **보관 기간**: 최근 10일 (오래된 백업 자동 삭제)
- **백업 방법**: Docker 컨테이너에서 데이터베이스 파일 복사

### 제공 스크립트

1. **[backup-db.sh](file:///home/developer/eventer-map/scripts/backup-db.sh)** - 데이터베이스 백업
2. **[restore-db.sh](file:///home/developer/eventer-map/scripts/restore-db.sh)** - 데이터베이스 복원

---

## 수동 백업

### 백업 실행

```bash
# 프로젝트 루트 디렉토리에서
./scripts/backup-db.sh
```

### 출력 예시

```
[2025-12-17 00:00:00] =====================================
[2025-12-17 00:00:00] 데이터베이스 백업 시작
[2025-12-17 00:00:00] =====================================
[2025-12-17 00:00:00] 컨테이너: eventer-map-backend
[2025-12-17 00:00:00] 백업 파일: /path/to/backups/eventer_backup_20251217_000000.db
[2025-12-17 00:00:00] ✓ 백업 완료: eventer_backup_20251217_000000.db (128K)
[2025-12-17 00:00:00] =====================================
[2025-12-17 00:00:00] 백업 완료!
[2025-12-17 00:00:00] =====================================
```

### 백업 로그 확인

모든 백업 작업은 로그 파일에 기록됩니다:

```bash
cat backups/backup.log
```

---

## 자동 백업 설정 (Cron)

### 1. Cron 작업 추가

매일 자정에 자동 백업을 실행하려면:

```bash
# crontab 편집
crontab -e
```

### 2. Cron 설정 추가

다음 라인을 추가합니다 (경로는 실제 프로젝트 경로로 수정):

```cron
# 매일 자정에 데이터베이스 백업 (프로젝트 경로 수정 필요)
0 0 * * * /home/developer/eventer-map/scripts/backup-db.sh >> /home/developer/eventer-map/backups/cron.log 2>&1
```

### 3. Cron 스케줄 예시

```cron
# 매일 자정
0 0 * * * /path/to/eventer-map/scripts/backup-db.sh

# 매일 오전 3시
0 3 * * * /path/to/eventer-map/scripts/backup-db.sh

# 매 6시간마다
0 */6 * * * /path/to/eventer-map/scripts/backup-db.sh

# 매주 일요일 자정
0 0 * * 0 /path/to/eventer-map/scripts/backup-db.sh
```

### 4. Cron 작업 확인

```bash
# 등록된 cron 작업 확인
crontab -l

# Cron 로그 확인
cat backups/cron.log
```

---

## 데이터베이스 복원

### 1. 복원 스크립트 실행

```bash
./scripts/restore-db.sh
```

### 2. 백업 선택

사용 가능한 백업 목록이 표시됩니다:

```
=====================================
사용 가능한 백업 파일
=====================================
 1) eventer_backup_20251217_000000.db (128K) - 2025-12-17 00:00:00
 2) eventer_backup_20251216_000000.db (127K) - 2025-12-16 00:00:00
 3) eventer_backup_20251215_000000.db (126K) - 2025-12-15 00:00:00

복원할 백업 번호를 선택하세요 (1-3, 0=취소): 
```

### 3. 복원 확인

```
경고: 현재 데이터베이스가 선택한 백업으로 교체됩니다.
현재 데이터베이스는 자동으로 백업됩니다.

계속하시겠습니까? (yes/no): yes
```

### 4. 복원 프로세스

1. **현재 DB 백업**: 복원 전 현재 데이터베이스를 `eventer_backup_pre_restore_*.db`로 백업
2. **데이터베이스 복원**: 선택한 백업을 컨테이너로 복사
3. **컨테이너 재시작**: 변경사항 적용을 위해 백엔드 재시작

### 5. 복원 완료 확인

```bash
# 백엔드 로그 확인
docker logs eventer-map-backend

# API 테스트
curl http://localhost:7773/health
```

---

## 백업 파일 관리

### 백업 목록 확인

```bash
# 모든 백업 파일 나열 (최신 순)
ls -lht backups/eventer_backup_*.db

# 백업 개수 확인
ls backups/eventer_backup_*.db | wc -l
```

### 백업 파일 정보

```bash
# 특정 백업 파일 크기
du -h backups/eventer_backup_20251217_000000.db

# 전체 백업 디렉토리 크기
du -sh backups/
```

### 수동 백업 삭제

```bash
# 특정 백업 삭제
rm backups/eventer_backup_20251215_000000.db

# 10일 이상 된 백업 수동 삭제
find backups/ -name "eventer_backup_*.db" -mtime +10 -delete
```

### 백업 다운로드 (로컬로)

```bash
# SCP를 사용하여 백업 다운로드
scp user@nas-ip:/path/to/eventer-map/backups/eventer_backup_*.db ./local-backups/

# rsync를 사용하여 전체 백업 디렉토리 동기화
rsync -avz user@nas-ip:/path/to/eventer-map/backups/ ./local-backups/
```

---

## 문제 해결

### 백업 스크립트가 실행되지 않음

**증상**: `./scripts/backup-db.sh` 실행 시 권한 오류

**해결**:
```bash
chmod +x scripts/backup-db.sh scripts/restore-db.sh
```

### 컨테이너를 찾을 수 없음

**증상**: `ERROR: 백엔드 컨테이너가 실행 중이지 않습니다`

**해결**:
```bash
# 프로덕션 컨테이너 실행 확인
docker ps | grep eventer-map-backend

# 컨테이너 시작
docker-compose -f docker-compose.pro.yml up -d
```

### 백업 디렉토리 권한 오류

**증상**: 백업 파일 생성 실패

**해결**:
```bash
# 백업 디렉토리 권한 확인 및 수정
mkdir -p backups
chmod 755 backups
```

### Cron이 작동하지 않음

**증상**: 자동 백업이 실행되지 않음

**해결**:
```bash
# Cron 서비스 상태 확인
systemctl status cron  # Debian/Ubuntu
systemctl status crond # CentOS/RHEL

# Cron 로그 확인
grep CRON /var/log/syslog  # Debian/Ubuntu
grep CRON /var/log/cron    # CentOS/RHEL

# 스크립트 절대 경로 사용 확인
crontab -l

# 수동으로 스크립트 테스트
/absolute/path/to/eventer-map/scripts/backup-db.sh
```

### 복원 후 데이터가 이상함

**증상**: 복원 후 데이터가 예상과 다름

**해결**:
```bash
# 복원 전 자동 백업된 파일로 재복원
./scripts/restore-db.sh
# 그리고 "eventer_backup_pre_restore_*" 파일 선택

# 또는 더 이전 백업으로 복원
ls -lht backups/eventer_backup_*.db
```

---

## 모범 사례

### 1. 정기적인 백업 확인

```bash
# 주간 백업 상태 확인 스크립트
echo "최근 백업:"
ls -lht backups/eventer_backup_*.db | head -5

echo -e "\n백업 디렉토리 크기:"
du -sh backups/
```

### 2. 외부 저장소에 백업 복사

중요한 데이터는 별도의 저장소에도 백업하세요:

```bash
# 주간 백업을 외부 스토리지로 복사 (예: USB 드라이브)
rsync -av backups/ /mnt/external-backup/eventer-backups/

# 클라우드 스토리지로 업로드 (예: rclone 사용)
rclone sync backups/ remote:eventer-backups/
```

### 3. 복원 테스트

정기적으로 백업 복원을 테스트하여 백업이 정상적으로 작동하는지 확인하세요.

---

## 추가 정보

- 백업 파일은 Git에 포함되지 않습니다 (`.gitignore` 설정됨)
- 백업은 SQLite WAL 모드를 고려하여 안전하게 수행됩니다
- 모든 작업은 로그에 기록되어 추적 가능합니다

---

**문의사항이나 문제가 있으면 GitHub Issues에 등록해주세요.**
