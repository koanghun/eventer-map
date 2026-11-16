# ☁️ AWS 서버리스 & 정적 배포 가이드 (AWS Deployment Guide)

[⬅️ 홈으로 돌아가기](./Home.md) | [관련 문서: 시스템 아키텍처](./ARCHITECTURE.md) | [기술 스택](./TECH_STACK.md)

이 문서는 Eventer Map의 **프론트엔드(S3 + CloudFront OAC)**, **백엔드(AWS Lambda + API Gateway)**, **데이터베이스(NAS Docker PostgreSQL)** 하이브리드 서버리스 배포 아키텍처와 원클릭 배포/CI·CD 운영 방법을 설명합니다.

---

## 1. 🗺️ 배포 인프라 아키텍처

```mermaid
flowchart LR
    User(["사용자 브라우저"])

    subgraph AWS_Cloud["AWS 클라우드 (단일 SAM Stack: eventer-map-stack)"]
        direction TB
        CF["Amazon CloudFront<br/>(HTTPS / HTTP3 / SPA 라우팅)"]
        S3[("Amazon S3 Bucket<br/>(React 정적 빌드본 · 비공개)")]
        APIGW["Amazon API Gateway<br/>(REST API Proxy)"]
        Lambda["AWS Lambda<br/>(Go arm64 · provided.al2023)"]
        DDB[("Amazon DynamoDB<br/>(OAuthStatesTable · TTL)")]

        CF -->|"OAC (SigV4 서명)<br/>정적 파일 조회"| S3
        APIGW -->|"/{proxy+} & /"| Lambda
        Lambda <-->|"PKCE state 저장/원자 소비"| DDB
    end

    subgraph NAS_Env["온프레미스 (Synology NAS - Docker)"]
        PG[("PostgreSQL 컨테이너<br/>(max_connections 보호)")]
    end

    User -->|"정적 웹 접속 (HTTPS)"| CF
    User -->|"API 호출 (CORS + Credentials)"| APIGW
    Lambda -->|"TLS 암호화 연결<br/>(제한된 sql.DB 커넥션 풀)"| PG
```

---

## 2. 🔧 1단계: 백엔드 서버리스 배포 대응 설계 (`backend/`)

### 2.1. Lambda ➔ NAS DB 커넥션 풀 제한 원리 (`cmd/server/main.go`)
상시 구동 서버(EC2 등)와 달리 **AWS Lambda는 동시 요청 수만큼 독립된 컨테이너(프로세스)가 각각 생성(Scale-out)**되며, 각 컨테이너는 요청이 끝난 뒤에도 수 분간 일시 정지(Freeze) 상태로 열린 TCP 커넥션을 유지합니다.

만약 Go `database/sql`의 기본값(`MaxOpenConns = 무제한`, `MaxIdleConns = 2`)을 그대로 사용하면 트래픽 급증 시 유휴/좀비 커넥션이 누적되어 NAS PostgreSQL(`max_connections=100`)이 고갈됩니다. 이를 방지하기 위해 `cmd/server/main.go`에 다음 4가지 제한을 적용합니다:

```go
db.SetMaxOpenConns(2)                  // 1) 단일 Lambda 컨테이너당 최대 활성 연결 수 제한
db.SetMaxIdleConns(1)                  // 2) Warm Start 재사용을 위해 유휴 연결은 딱 1개만 유지
db.SetConnMaxLifetime(5 * time.Minute) // 3) 공유기 NAT/방화벽 세션 타임아웃(broken pipe) 방지를 위해 5분마다 갱신
db.SetConnMaxIdleTime(1 * time.Minute) // 4) 1분 이상 놀고 있는 유휴 연결은 즉시 반환
```

| 설정 메서드 | 설정값 | 핵심 역할 및 기대 효과 |
| :--- | :--- | :--- |
| `SetMaxOpenConns` | `2` | Lambda 인스턴스 1개는 동시에 1개의 요청만 처리하므로 과도한 연결 생성을 원천 차단 |
| `SetMaxIdleConns` | `1` | 연속된 API 호출(Warm Start) 시 TCP/TLS 핸드셰이크 오버헤드를 제거하면서 유휴 연결을 절반으로 축소 |
| `SetConnMaxLifetime` | `5m` | AWS ➔ 외부 공유기(NAT) ➔ NAS 구간에서 유휴 TCP 세션이 방화벽에 의해 강제 종료되어 발생하는 `connection reset` 에러 방지 |
| `SetConnMaxIdleTime` | `1m` | 트래픽이 빠진 후 대기 중인 Lambda 컨테이너의 DB 연결을 신속히 회수 |

### 2.2. 프로덕션 쿠키(`refreshToken`) 보안 및 도메인 분기 (`internal/handler/auth_handler.go`)
- `buildRefreshTokenCookie()` 헬퍼를 통해 로컬(`ENV=local`)과 배포 환경(`ENV=prod`)의 쿠키 정책을 자동 분기합니다.
  - **`Secure` 플래그**: `ENV != "local"`일 때 자동으로 `Secure: true`가 적용되어 HTTPS 통신에서만 쿠키가 전송됩니다.
  - **`SameSite` 모드 (`COOKIE_SAMESITE`)**:
    - CloudFront 기본 도메인(`*.cloudfront.net`)과 API Gateway 기본 도메인(`*.execute-api.<region>.amazonaws.com`)을 각각 사용할 경우 Cross-Origin 요청에서 쿠키가 전송되도록 `COOKIE_SAMESITE=None`(`Secure: true` 필수)을 지원합니다.
    - 커스텀 도메인(`eventermap.com` + `api.eventermap.com`)을 연결한 경우 `COOKIE_SAMESITE=Lax`와 `COOKIE_DOMAIN=.eventermap.com`으로 전환할 수 있습니다.

### 2.3. JWT 서명 시크릿 환경변수 분리 (`internal/service/auth_service.go`)
- `GetJWTSecret()` 함수가 `JWT_SECRET` 환경변수를 우선 로드하며, 설정되지 않은 로컬 개발 환경에서만 개발용 기본 키로 폴백합니다.

---

## 3. 🏗️ 2단계: AWS SAM 통합 인프라 템플릿 (`backend/template.yaml`)

별도의 서드파티 IaC 도구 없이 **`backend/template.yaml` 단일 파일**로 백엔드와 프론트엔드 리소스를 한 번에 관리합니다 (기본 리전: `ap-southeast-2` Sydney).

### 주요 프로비저닝 리소스
1. **`EventerMapApiFunction` (`AWS::Serverless::Function`)**:
   - **런타임/아키텍처**: `provided.al2023` + `arm64` (Graviton2 기반으로 x86 대비 가격 대비 성능 20% 이상 우수)
   - **빌드 방식**: `BuildMethod: makefile` (`GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -ldflags="-s -w"`)로 바이너리 크기를 최소화하여 콜드 스타트를 단축합니다.
   - **바이너리 미디어 타입**: `Globals.Api.BinaryMediaTypes`에 `multipart~1form-data`를 등록하여 이미지 업로드(`POST /artists`) 시 바이너리 손상을 방지합니다.
   - **자동 URL 연동**: `CORS_ORIGINS` 및 `X_REDIRECT_URI`가 비어 있더라도 생성된 `FrontendDistribution.DomainName` (`https://<cloudfront>`)을 자동으로 포함합니다.
   - **최소 권한 IAM**: `MediaBucket` CRUD 권한(`S3CrudPolicy`)과 `OAuthStatesTable`에 대한 `dynamodb:PutItem`, `dynamodb:DeleteItem` 권한만 부여합니다.
2. **`MediaBucket` (`AWS::S3::Bucket`) + `MediaBucketPolicy`**:
   - 출연자 프로필 이미지 등 업로드 미디어 저장용 버킷이며, `MediaBucketPolicy`로 `/artists/profiles/*` 경로의 공개 읽기(`s3:GetObject`)만 허용합니다.
3. **`OAuthStatesTable` (`AWS::DynamoDB::Table`)**:
   - On-Demand(`PAY_PER_REQUEST`) 요금제, `state_hash` 파티션 키, `expires_at` TTL 자동 삭제 및 서버 측 암호화(`SSESpecification`)가 적용된 단기 OAuth PKCE/CSRF 상태 저장소입니다.
4. **`FrontendBucket` (`AWS::S3::Bucket`) + `FrontendBucketPolicy`**:
   - 모든 퍼블릭 액세스를 차단(`PublicAccessBlockConfiguration: true`)하고, 오직 CloudFront OAC를 통한 읽기(`s3:GetObject`)만 허용합니다.
5. **`FrontendOriginAccessControl` & `FrontendDistribution` (`AWS::CloudFront::Distribution`)**:
   - **HTTPS 강제 적용** (`ViewerProtocolPolicy: redirect-to-https`) 및 **HTTP/2 & HTTP/3** 활성화 (`PriceClass_200`)
   - **SPA 라우팅 지원 (`CustomErrorResponses`)**: React Router 경로(`/auth/x/callback` 등)로 직접 접속하거나 새로고침할 때 S3가 반환하는 `403`/`404` 응답을 `/index.html` (`200 OK`)로 변환하여 정상 렌더링합니다.
   - X Developer Portal Callback URI도 동일하게 `https://<프론트엔드 도메인>/auth/x/callback`으로 등록해야 합니다.

---

## 4. 🚀 3단계: 원클릭 배포 스크립트 및 GitHub Actions CI/CD

### 4.1. 로컬 원클릭 배포 (`Makefile`)
루트 [`Makefile`](../Makefile)은 CloudFormation Stack Output(`EventerMapApi`, `FrontendBucketName`, `CloudFrontDistributionId`)을 자동으로 조회하여 수동 복사/붙여넣기 없이 배포합니다. (`backend/Makefile`의 `make deploy`는 SAM CLI가 없으면 AWS CLI `cloudformation package + deploy`로 자동 폴백합니다.)

#### 로컬 DB vs AWS 배포 DB 분리 (`PROD_DATABASE_URL`)
- `backend/.env`에서 로컬 개발용 내부망 DB(`DATABASE_URL`, 예: `192.168.11.2:6930`)와 AWS Lambda 배포용 공인/DDNS DB(`PROD_DATABASE_URL`, 예: `ludwig1824.synology.me:6930`)를 분리하여 관리할 수 있습니다.
- `make deploy-be` 실행 시 `PROD_DATABASE_URL`이 설정되어 있으면 우선 사용하며, 사설/루프백 IP가 Lambda에 잘못 주입되지 않도록 사전 차단합니다.

#### 프론트엔드 차등 캐싱 전략 (`make deploy-fe`)
- `frontend/.env`에서 Google Maps / OAuth 키를 로드하되, `REACT_APP_API_URL`은 CloudFormation Stack Output(`EventerMapApi`)으로 자동 덮어써서 로컬 주소(`http://localhost:8080`)가 프로덕션 빌드에 섞이지 않도록 보장합니다.
- **해시된 정적 에셋 (`build/static/*`)**: 파일명에 콘텐츠 해시가 포함되므로 `Cache-Control: public, max-age=31536000, immutable` 헤더를 부여해 브라우저와 CloudFront에 **1년간 영구 캐싱**합니다.
- **엔트리 파일 (`index.html`, `asset-manifest.json`)**: 배포 즉시 새 버전을 가리켜야 하므로 `Cache-Control: no-cache, no-store, must-revalidate`를 부여하고, CloudFront 무효화(Invalidation)도 `/index.html`과 `/` 경로만 최소 실행하여 비용과 반영 시간을 절약합니다.

#### 명령어 요약
```bash
# 0. AWS CLI 미설치 시 사용자 영역(~/.local/bin)에 설치 후 자격 증명 등록
make install-aws-cli
aws configure

# 1. 배포 전 CLI, 자격 증명, backend/.env, frontend/.env 사전 점검
make deploy-check

# 2. 로컬 CI 검증 (OpenAPI/sqlc/Orval 코드 생성 정합성 + 백엔드/프론트엔드 테스트·빌드)
make verify-codegen
make ci

# 3. (선택) GitHub Actions OIDC IAM Role 생성 및 GitHub Secrets 일괄 동기화
make setup-oidc
make setup-github-secrets

# 4. 최초 1회: backend/.env에 배포 환경변수 설정 후 백엔드 & 인프라 생성
make deploy-be

# 5. 생성된 CloudFront URL 및 API Gateway 엔드포인트 확인
make stack-outputs

# 6. 프론트엔드 빌드 + S3 동기화 + CloudFront 캐시 무효화
make deploy-fe

# 7. 이후 백엔드 + 프론트엔드 통합 배포 시
make deploy-all
```

### 4.2. GitHub Actions CI/CD 파이프라인 (`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`)

#### 1) CI 검증 파이프라인 (`.github/workflows/ci.yml`)
`main`, `release`, `develop`, `aws-dev` 브랜치로의 Push 및 Pull Request(또는 `workflow_dispatch`)마다 다음 2개의 Job이 병렬로 실행됩니다:
1. **`backend-ci`**:
   - `oapi-codegen@v2.8.2` 및 `sqlc@v1.31.1`을 설치한 뒤 `make generate`를 실행하고 `git diff --exit-code`로 OpenAPI/SQL 자동 생성 코드의 정합성을 검증합니다.
   - `go vet ./...`, `go test -v -race ./...`, AWS Lambda `linux/arm64` 바이너리 빌드(`make build`)를 검증합니다.
2. **`frontend-ci`**:
   - `npm ci` 후 `npm run generate:api`를 실행하고 `git diff --exit-code src/api/generated/`로 Orval 생성 코드 정합성을 검증합니다.
   - `npx tsc --noEmit`, `CI=true npm test -- --watchAll=false`, `CI=true npm run build`를 검증합니다.

#### 2) CD 자동 배포 파이프라인 (`.github/workflows/deploy.yml`)
[`backend/github-oidc.yaml`](../backend/github-oidc.yaml)(`make setup-oidc`)로 OIDC 연동을 완료하고 `make setup-github-secrets`(또는 GitHub Web UI)로 Secrets를 등록한 뒤, `main` 또는 `release` 브랜치에 푸시하거나 `workflow_dispatch`(`stage`: `prod`/`dev`)로 수동 실행하면 아래 순서대로 실행됩니다:
1. **`verify-backend` & `verify-frontend` (사전 품질 게이트)**:
   - 코드 생성 정합성, 타입체크, 단위 테스트, 빌드 검증을 모두 통과해야만 실제 AWS 배포 Job이 시작됩니다.
2. **`deploy-backend`**:
   - 필수 GitHub Secrets(`AWS_ROLE_ARN`, `DATABASE_URL`/`PROD_DATABASE_URL`, `JWT_SECRET`) 존재 여부를 먼저 확인합니다.
   - AWS IAM OIDC(`aws-actions/configure-aws-credentials@v4`)로 임시 권한을 획득하고 `make deploy`를 실행하여 Lambda 및 인프라를 갱신합니다.
   - CloudFormation Stack Output에서 `api_url`, `s3_bucket`, `cf_dist_id`, `frontend_url`, `media_bucket`을 추출해 다음 Job으로 전달합니다.
3. **`deploy-frontend`**:
   - 필수 GitHub Secrets(`REACT_APP_GOOGLE_MAPS_API_KEY`, `REACT_APP_GOOGLE_CLIENT_ID`) 존재 여부를 확인한 뒤, 전달받은 `api_url`을 `REACT_APP_API_URL`에 자동 주입하여 `CI=true npm run build`를 수행합니다.
   - S3 차등 캐싱 업로드 및 CloudFront 캐시 무효화를 완료한 뒤, `$GITHUB_STEP_SUMMARY`에 배포 URL 요약표를 출력합니다.

#### 배포 환경변수 / GitHub Secrets & Variables 목록
| 구분 | 이름 | 설명 | 비고 |
| :--- | :--- | :--- | :--- |
| **Secrets** | `AWS_ROLE_ARN` | GitHub OIDC 연동용 AWS IAM Role ARN (`make setup-oidc` 출력값) | 필수 |
| **Secrets** | `DATABASE_URL` | 외부 접속 가능한 PostgreSQL URL (`?sslmode=require&connect_timeout=5` 권장) | 필수 (로컬에서는 `PROD_DATABASE_URL` 우선) |
| **Secrets** | `PROD_DATABASE_URL` | Lambda 배포 전용 DB URL (설정 시 `DATABASE_URL`보다 우선) | 선택 |
| **Secrets** | `JWT_SECRET` | 프로덕션 JWT 서명 시크릿 키 | 필수 |
| **Secrets** | `CORS_ORIGINS` | 추가 허용 프론트엔드 Origin (예: 커스텀 도메인). CloudFront URL은 자동 추가됨 | 선택 |
| **Secrets** | `COOKIE_DOMAIN` | 커스텀 도메인 공유 시 예: `.eventermap.com` | 선택 |
| **Secrets** | `COOKIE_SAMESITE` | 기본값 `None` (동일 루트 도메인 사용 시 `Lax`) | 선택 |
| **Secrets** | `X_CLIENT_ID` | X Developer Portal OAuth 2.0 Client ID | X 로그인 사용 시 |
| **Secrets** | `X_CLIENT_SECRET` | X Developer Portal OAuth 2.0 Client Secret (백엔드 전용) | X 로그인 사용 시 |
| **Secrets** | `X_REDIRECT_URI` | X OAuth 2.0 Callback URL (비워두면 `https://<cloudfront>/auth/x/callback` 자동 설정) | 선택 |
| **Vars / Secrets** | `X_REQUEST_EMAIL` | `true` 설정 시 `users.email` 스코프 요청 (기본값 `false`) | 선택 |
| **Secrets** | `SMTP_HOST` | SMTP 메일 서버 호스트 (비워두면 CloudWatch Logs MockMailer 동작) | 이메일 인증 사용 시 |
| **Vars / Secrets** | `SMTP_PORT` | SMTP 포트 (기본값 `587`, SSL 사용 시 `465`) | 선택 |
| **Secrets** | `SMTP_USER` | SMTP 로그인 아이디 | 이메일 인증 사용 시 |
| **Secrets** | `SMTP_PASSWORD` | SMTP 로그인 비밀번호 / 앱 비밀번호 | 이메일 인증 사용 시 |
| **Secrets** | `SMTP_FROM` | 발신자 이메일 주소 (비워두면 `SMTP_USER` 사용) | 선택 |
| **Secrets** | `REACT_APP_GOOGLE_MAPS_API_KEY` | 프론트엔드 Google Maps JavaScript API 키 | 필수 |
| **Secrets** | `REACT_APP_GOOGLE_CLIENT_ID` | 프론트엔드 Google OAuth Client ID | 필수 |

### 4.3. X Developer Portal & 로컬 개발 환경 설정 팁
- **X Developer Portal 설정**:
  - **Type of App**: `Web App, Automated App or Bot` (**Confidential client**)
  - **Callback URI / Redirect URL**: 프로덕션은 `https://<CloudFront 또는 커스텀 도메인>/auth/x/callback`, 로컬은 `http://localhost:3000/auth/x/callback`
  - **Request email from users** 옵션: 기본 `X_REQUEST_EMAIL=false`일 때는 꺼두어도 정상 가입·연동되며, `true`로 사용할 경우 Portal에서도 이메일 권한 및 이용약관/개인정보처리방침 URL을 활성화해야 합니다.
- **로컬 개발(`ENV=local`) 환경변수**:
  - `DYNAMODB_OAUTH_STATE_TABLE`을 비워두면 자동으로 단일 프로세스 `InMemoryOAuthStateStore`로 동작합니다. 로컬 DynamoDB(LocalStack/DynamoDB Local)를 연동하려면 `DYNAMODB_OAUTH_STATE_TABLE`과 `DYNAMODB_ENDPOINT_URL`을 함께 설정합니다.
  - 비-로컬(`ENV != local` 또는 Lambda) 환경에서 `DYNAMODB_OAUTH_STATE_TABLE`이 누락되면 fail-closed로 X OAuth 요청을 거부(`503 X_OAUTH_NOT_CONFIGURED`)합니다.

> **💡 DB 마이그레이션 보안 팁**: NAS의 PostgreSQL 포트를 GitHub Actions의 불특정 IP 대역에 개방하는 대신, 스키마 마이그레이션(`cd backend && make migrateup`)은 로컬 개발 PC 또는 NAS 내부망에서 실행하는 것을 권장합니다.

---
*문서 최종 업데이트: 2026-11-16*
