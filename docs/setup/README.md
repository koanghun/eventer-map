# 설정 가이드 (Setup)

개발 및 프로덕션 환경 설정에 필요한 모든 가이드를 제공합니다.

## 📚 가이드 목록

### [개발 환경 설정 (DEVELOPMENT.md)](./DEVELOPMENT.md)
개발 환경 구축을 위한 종합 가이드
- Docker Compose를 사용한 개발 환경 구축
- SSH 컨테이너 통합 방식
- VS Code Remote SSH 연동
- Python 디버깅 설정
- Hot reload 및 개발 워크플로우

### [환경 변수 (ENVIRONMENT_VARIABLES.md)](./ENVIRONMENT_VARIABLES.md)
환경 변수 상세 설명
- 백엔드/프론트엔드 환경 변수
- 개발/프로덕션 환경별 설정
- Google Maps API 키 설정
- OAuth 관련 환경 변수

### [Google OAuth 설정 (GOOGLE_OAUTH_SETUP.md)](./GOOGLE_OAUTH_SETUP.md)
Google OAuth 2.0 인증 설정
- Google Cloud Console 설정
- OAuth 클라이언트 ID 생성
- 백엔드/프론트엔드 통합
- 테스트 및 트러블슈팅

### [트러블슈팅 (TROUBLESHOOTING.md)](./TROUBLESHOOTING.md)
일반적인 문제 해결 가이드
- Google OAuth 에러
- CORS 에러
- 프록시 404 에러
- 환경변수 로드 문제
- 유용한 디버깅 명령어

## 🚀 빠른 시작

### 처음 설정하는 경우

1. [DEVELOPMENT.md](./DEVELOPMENT.md) 읽고 개발 환경 구축
2. [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)에서 필요한 환경 변수 설정
3. (선택) [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)에서 OAuth 설정

### 문제가 발생한 경우

[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)를 먼저 확인하세요.

## 📂 관련 문서

- [배포 가이드](../deployment/) - 프로덕션 배포 방법
- [운영 가이드](../operations/) - 백업 및 유지보수
- [프로젝트 개요](../PROJECT_OVERVIEW.md) - 프로젝트 전체 구조
