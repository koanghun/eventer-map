# AWS 배포 가이드 및 프로젝트 구성 변경 제안

현재 **Synology NAS (Docker Compose)** 기반의 배포 환경에서 **AWS (Amazon Web Services)**로 이전할 때, **비용 효율성**, **가용성**, **유지보수 편의성**을 극대화하기 위해 변경해야 할 구성을 제안합니다.

---

## 🏗️ 1. 아키텍처 아웃라인 비교

| 구성 요소 | 현재 (Synology NAS) | AWS 추천 아키텍처 (효율형) | 변경 이유 / 이점 |
| :--- | :--- | :--- | :--- |
| **프론트엔드** | Nginx Docker 컨테이너 | **S3 + CloudFront** | 서버리스 서빙으로 비용 절감, Edge 단 가속, 무한 확장 |
| **백엔드 (API)** | Docker Compose (FastAPI) | **ECS Fargate** 또는 **App Runner** | 가상 머신(EC2) 관리 불필요, 오토스케일링, 높은 가용성 |
| **데이터베이스** | Docker Postgres | **Amazon RDS for PostgreSQL** | 자동 백업, 패치 관리, 고가용성(Multi-AZ) 지원 |
| **추출기 (Cron)** | 호스트 크론 / 도커 컨테이너 | **ECS Scheduled Task** 또는 **Lambda** | 필요할 때만 실행하여 컴퓨팅 비용 최적화 (서버리스) |
| **도메인 / SSL** | Synology 역방향 프록시 / Let's Encrypt | **Route 53 + ACM (Certificate Manager)** | AWS 통합 관리, 인증서 자동 갱신 및 보안 강화 |
| **비밀번호 관리** | `.env.production` 파일 | **Secrets Manager** 또는 **Parameter Store** | API 키 및 DB 비밀번호 보안 강화, 중앙 관리 |

---

## 🛠️ 2. 영역별 상세 변경 사항 및 설정 제안

### 🟢 A. 프론트엔드 (React)
- **현재 구조**: React 빌드 결과물을 Nginx 컨테이너에 담아 Docker 파일로 배포
- **AWS 변경 사항**:
  1. **S3 버킷**: 빌드된 정적 파일(`npm run build` 결과물)을 S3에 업로드합니다.
  2. **CloudFront (CDN)**: S3 앞에 CloudFront를 배치하여 HTTPS를 적용하고 전 세계 Edge Location에서 캐싱 서빙합니다.
- **프로젝트 소스 코드 변경**:
  - `frontend/Dockerfile` 및 `frontend/nginx.conf` 제거 가능 (AWS 비용 및 관리 오버헤드 감소).
  - API 주소 배선 관리: CloudFront의 `Behaviors` 설정을 이용해 `/api/*` 경로를 백엔드로 라우팅하면 **CORS 이슈가 원천 차단**됩니다.

---

### 🔵 B. 백엔드 (FastAPI)
- **현재 구조**: Docker Compose 네트워크 내에서 `postgres` 컨테이너와 연결
- **AWS 변경 사항**:
  1. **컨테이너화**: 기존 `backend/Dockerfile`은 그대로 사용 가능합니다.
  2. **오케스트레이션**: **AWS App Runner** (가장 간단) 또는 **Amazon ECS (Fargate)**에 배포합니다.
- **프로젝트 소스 코드 변경**:
  - `database.py` DB 주소 처리: RDS 엔드포인트를 주입받도록 `.env` 환경 변수 구성 변경.
  - ECS 실행 시 IAM Role을 부여하여 AWS 리소스(S3, SES 등)에 접근할 수 있게 설정합니다.

---

### 🟠 C. 데이터베이스 (PostgreSQL)
- **현재 구조**: 컨테이너 볼륨 바인딩 구조 (백업 수동 관리 위험 존재)
- **AWS 변경 사항**:
  - **AWS RDS for PostgreSQL** (정기 백업, 가용성 보장) 사용을 강력히 권장합니다.
- **프로젝트 구성 변경**:
  - `docker-compose.yml`에서 DB 컨테이너 선언 제거 가능.
  - 초기 데이터 마이그레이션 (`alembic upgrade head`) 시 AWS 환경에서의 배포 파이프라인 연동 필요.

---

### 🟣 D. 이벤트 추출기 (Event Extractor)
- **현재 구조**: 단독 실행형 스크립트 (Synology 크론 등으로 주기적 가동 추정)
- **AWS 변경 사항**:
  - **ECS Scheduled Task (Fargate)** 또는 시간 제한(15분) 내라면 **AWS Lambda** 활용.
  - **Amazon EventBridge**를 Cron 스케줄러로 설정하여 주기적으로 컨테이너/함수를 트리거합니다.
- **구조적 이점**: 추출기가 작동하는 시간(예: 하루 1회 10분)에만 요금이 발생하므로 **비용이 0에 수렴**합니다.

---

## 🔐 3. 보안 및 관리 (Secrets Management)

- **백엔드 `.env` 전면 제거**:
  - Google Maps API Key, Google Client Secret, JWT Secret 등은 코드 저장소나 컨테이너 환경 변수에 그대로 노출하기보다 **AWS Secrets Manager**에 저장합니다.
  - 컨테이너 시작 시 AWS SDK를 통해 조회하거나 ECS 구동 시 환경 변수로 직접 주입받을 수 있습니다.

---

## 🚀 4. CI/CD 배포 파이프라인 (GitHub Actions)

기존 `deploy.sh` 형태의 수동 배포 대신 자동화합니다.

1. **Frontend**: Code Push ➡️ GitHub Actions 빌드 ➡️ **S3 Upload** & CloudFront Invalidation
2. **Backend**: Code Push ➡️ GitHub Actions 빌드 ➡️ **Amazon ECR (컨테이너 저장소) Push** ➡️ ECS Fargate 서비스 업데이트

---

## 💡 비용 최적화 (Cost Saving) 팁

1. **S3 + CloudFront 조합**: Frontend 서빙용 EC2 서버를 온전히 없앨 수 있어 기본 유지비가 획기적으로 낮아집니다.
2. **RDS 스펙**: 사이드 프로젝트 급이라면 `db.t4g.micro` 혹은 `Aurora Serverless V2` 탑재 고려.
3. **Fargate Spot**: 백엔드 또는 추출기를 **Spot 인스턴스**로 가동하면 비용을 최대 70%까지 아낄 수 있습니다. (추출기 등에 매우 적합)
