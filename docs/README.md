# Eventer Map Documentation (이벤트 맵 공식 문서)

이벤트 맵 프로젝트의 개발 및 운영에 필요한 최신 가이드라인을 제공합니다.

## 🚀 주요 문서 가이드

| 문서 명칭 | 설명 |
| :--- | :--- |
| **[개발 가이드 (DEVELOPMENT.md)](./DEVELOPMENT.md)** | 로컬 개발 환경 구축, 환경 변수 설정, DB 관리, 트러블슈팅 및 프론트엔드 스타일 가이드 |
| **[배포 및 운영 가이드 (DEPLOYMENT.md)](./DEPLOYMENT.md)** | 시놀로지 NAS 배포 절차, 도메인/네트워크 설정, DB 백업 및 복구 절차 |
| **[기능 및 설계 문서 (FEATURES.md)](./performer-place-manager.md)** | 연주자/장소 관리 기능 등 프로젝트의 주요 기능 상세 설명 및 설계 철학 |

---

## 🛠️ 프로젝트 기술 스택

- **Backend**: FastAPI (Python 3.11), SQLAlchemy 2.0, Alembic
- **Frontend**: React (TypeScript), Tailwind CSS, shadcn/ui, TanStack Query
- **Database**: PostgreSQL (Production), SQLite (Development)
- **Infrastructure**: Docker, Docker Compose, Synology NAS

---

## 📂 문서 관리 규칙

- **최신성 유지**: 모든 문서는 실제 코드 변경 사항에 맞춰 실시간으로 업데이트되어야 합니다.
- **간결함**: 불필모한 중복 문서는 삭제하고 이 핵심 문서 3종을 중심으로 관리합니다.
- **언어**: 모든 공식 문서는 한국어(KR)를 우선적으로 사용합니다.

---

**ⓒ 2026 Eventer Map Team. All rights reserved.**
