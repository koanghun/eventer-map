# 운영 가이드 (Operations)

프로덕션 환경 운영과 유지보수에 필요한 가이드를 제공합니다.

## 📚 가이드 목록

### [백업 가이드 (backup-guide.md)](./backup-guide.md)
데이터베이스 백업 및 복원 종합 가이드
- 백업 시스템 개요
- 수동 백업 실행
- 자동 백업 설정 (Cron)
- 데이터베이스 복원
- 백업 파일 관리
- 문제 해결

**주요 기능:**
- 자동 백업 스크립트 (`backup-db.sh`)
- 복원 스크립트 (`restore-db.sh`)
- 10일 자동 보관 주기
- 백업/복원 로그 기록

### [세션 종료 (SESSION_CLOSING.md)](./SESSION_CLOSING.md)
개발/운영 세션 종료 시 체크리스트

## 🚀 빠른 시작

### 백업 설정

#### 수동 백업
```bash
./scripts/backup-db.sh
```

#### 자동 백업 (Cron)
```bash
# crontab 편집
crontab -e

# 매일 자정 백업 (경로 수정 필요)
0 0 * * * /path/to/eventer-map/scripts/backup-db.sh >> /path/to/eventer-map/backups/cron.log 2>&1
```

### 데이터베이스 복원

```bash
./scripts/restore-db.sh
```

사용 가능한 백업 목록에서 선택하여 복원할 수 있습니다.

## ⚠️ 중요 사항

> [!CAUTION]
> **정기 백업은 필수입니다!**
> 
> 데이터 손실을 방지하기 위해 자동 백업을 반드시 설정하세요.

### 백업 체크리스트

- [ ] 백업 스크립트 실행 권한 확인 (`chmod +x scripts/backup-db.sh`)
- [ ] 수동 백업 테스트 완료
- [ ] Cron 자동 백업 설정 완료
- [ ] 백업 로그 확인 (`cat backups/backup.log`)
- [ ] 복원 테스트 완료

## 📂 관련 문서

- [배포 가이드](../deployment/) - 프로덕션 배포
- [설정 가이드](../setup/) - 환경 설정
- [프로젝트 개요](../PROJECT_OVERVIEW.md) - 프로젝트 전체 구조
