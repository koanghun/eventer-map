# 배포 가이드 (Deployment)

프로덕션 환경 배포에 필요한 모든 정보를 제공합니다.

## 📚 가이드 목록

### [배포 가이드 (DEPLOYMENT_GUIDE.md)](./DEPLOYMENT_GUIDE.md)
프로덕션 배포 종합 가이드
- 배포 전 체크리스트
- 환경 변수 설정
- Google Maps API 보안 설정
- Docker Compose 배포
- Synology NAS 특화 설정
- 외부 접근 설정 (포트 포워딩, 역방향 프록시, HTTPS)
- 트러블슈팅
- 업데이트 및 유지보수

## 🚀 빠른 시작

### 배포 절차

1. **환경 변수 설정**
   - `.env` 파일 생성 및 수정
   - Google Maps API 키 발급 및 제한 설정

2. **Docker Compose 빌드 및 실행**
   ```bash
   docker-compose -f docker-compose.pro.yml build
   docker-compose -f docker-compose.pro.yml up -d
   ```

3. **접속 확인**
   - 프론트엔드: `http://NAS-IP:65104`
   - 백엔드 API: `http://NAS-IP:65105`

### Synology NAS 사용자

Container Manager를 사용한 GUI 배포를 지원합니다. 자세한 내용은 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#synology-nas-특화-설정)를 참조하세요.

## ⚠️ 배포 전 필수 확인사항

- [ ] Google Maps API 키 제한 설정 완료
- [ ] CORS 설정에 실제 접속 URL 포함
- [ ] 환경 변수 파일 보안 확인
- [ ] 백업 시스템 설정 (자세한 내용은 [백업 가이드](../operations/backup-guide.md) 참조)

## 📂 관련 문서

- [설정 가이드](../setup/) - 개발 환경 설정
- [운영 가이드](../operations/) - 백업 및 유지보수
- [프로젝트 개요](../PROJECT_OVERVIEW.md) - 프로젝트 전체 구조
