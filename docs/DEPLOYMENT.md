# 배포 및 운영 가이드 (Deployment & Operations Guide)

이 문서는 Eventer Map 프로젝트를 시놀로지 NAS(Synology NAS) 환경에 배포하고 유지관리하는 방법을 안내합니다.

## 📋 목차
1. [시놀로지 NAS 배포 절차](#1-시놀로지-nas-배포-절차)
2. [네트워크 설정 (MyDNS)](#2-네트워크-설정-mydns)
3. [데이터베이스 백업 및 복원](#3-데이터베이스-백업-및-복원)
4. [운영 정보 관리](#4-운영-정보-관리)

---

## 1. 시놀로지 NAS 배포 절차

### 사전 준비
- Docker 패키지 설치 (DSM 7.2 이상 권장)
- SSH 접속 활성화 (제어판 > 터미널 및 SNMP)
- `.env.production` 설정을 기반으로 한 `.env` 파일 작성 (특히 `POSTGRES_PASSWORD` 및 `GOOGLE_REDIRECT_URI`)

### 배포 명령어
```bash
# 프로젝트 디렉토리로 이동
cd /volume1/docker/eventer-map

# 최신 코드로 업데이트 (작업 환경에 따라 다름)
git pull origin develop

# 서비스 빌드 및 백그라운드 실행
docker-compose -f docker-compose.pro.yml up -d --build

# 로그 모니터링
docker-compose -f docker-compose.pro.yml logs -f
```

---

## 2. 네트워크 설정 (MyDNS)

운영 환경에서는 MyDNS 서비스를 통해 도메인과 NAS의 유동 IP를 연동하여 외부에 서비스를 노출합니다.

### 주요 설정
- **도메인**: `https://eventermap.mydns.jp` (또는 설정된 도메인)
- **역방향 프록시 (DSM 설정)**:
  - 소스: `https://[도메인]:443`
  - 대상: `http://localhost:7772` (프론트엔드 포트)
- **포트 포워딩 (공유기 설정)**: 외부 `443` 포트를 NAS IP의 `443` 포트로 포워딩합니다.

---

## 3. 데이터베이스 백업 및 복원

운영 데이터(PostgreSQL)의 안전한 보관을 위해 정기적인 백업을 수행합니다.

### 수동 백업 실행
```bash
# 프로젝트 루트 디렉토리의 백업 스크립트 실행
./scripts/backup-db.sh
```
백업 파일은 `backups/` 디렉토리에 `eventer_backup_YYYYMMDD_HHMMSS.db` 형식으로 저장됩니다.

### 자동 백업 설정 (Cron)
DSM의 "작업 스케줄러" 또는 일반 crontab에 등록하여 매일 자정 자동 백업을 수행할 수 있습니다.
```bash
# crontab 예시 (매일 자발적 백업)
0 0 * * * /path/to/eventer-map/scripts/backup-db.sh >> /path/to/eventer-map/backups/cron.log 2>&1
```

---

## 4. 운영 정보 관리

### 세션 종료 및 기록 (`SESSION_CLOSING.md`)
작업 마감 시 `docs/logs/`에 개발 기록을 남기는 것이 권장됩니다. 이 기록은 AI 어시스턴트가 다음 작업 시작 시 프로젝트의 현재 컨텍스트를 파악하는 데 큰 도움을 줍니다.

### 주요 운영 파일
- `docker-compose.pro.yml`: 프로덕션 서비스 정의
- `frontend/nginx.conf`: Nginx 프록시 및 보안 설정
- `scripts/`: 백업, 복원, 유지보수 유틸리티 스크립트 모음

---

> [!IMPORTANT]
> 운영 환경 변경 사항(예: 환경 변수, 포트 번호 등)은 반드시 팀원에게 공유하고 문서를 업데이트해 주세요.
