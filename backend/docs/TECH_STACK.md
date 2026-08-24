# 백엔드 기술 스택 명세서 (TECH STACK)

이 문서는 Eventer Map 프로젝트 백엔드 서비스의 아키텍처 및 확정된 기술 스택을 정의합니다.

## 1. 아키텍처 개요 (Architecture Overview)
- **접근 방식:** Serverless Architecture (서버리스 아키텍처)
- **특징:** 트래픽에 따른 자동 확장, 사용한 만큼만 지불하는 비용 효율성, 인프라 관리 최소화.

## 2. 인프라 및 배포 (Infrastructure & Deployment)
- **클라우드 프로바이더:** AWS (Amazon Web Services)
- **핵심 서비스:** AWS Lambda (컴퓨팅), Amazon API Gateway (API 라우팅)
- **IaC (인프라 코드화) 도구:** **AWS SAM** (Serverless Application Model)
  - 선택 이유: 서버리스 애플리케이션 구축 및 배포에 특화되어 있으며, 로컬 환경에서의 빠르고 간편한 API 테스트를 지원합니다.

## 3. 백엔드 애플리케이션 (Backend Application)
- **개발 언어:** **Go (Golang)**
- **프레임워크 / 라우터:** **Go 표준 라이브러리 (`net/http`)**
  - 선택 이유: Go의 기본기를 강화하고, 의존성을 최소화하여 AWS Lambda 환경에서의 콜드 스타트(Cold Start) 속도를 극대화하기 위함입니다. 외부 프레임워크(Echo, Gin 등) 대신 표준을 채택했습니다.

## 4. API 개발 방식 (API Development)
- **방식:** 스키마 퍼스트 (Schema-First) 개발
- **명세 언어:** OpenAPI 3.0
- **코드 생성 도구:** **`deepmap/oapi-codegen`**
  - 선택 이유: OpenAPI 명세서(`openapi.yaml`)를 작성하면 Go 라우팅 인터페이스와 모델 코드를 자동 생성해주어, 명세와 구현의 불일치를 원천 차단합니다.

## 5. 데이터베이스 (Database)
- **DBMS:** PostgreSQL
- **호스팅 서비스:** **NEON** (Serverless Postgres)
- **DB 연동 및 쿼리 도구:** **`sqlc`**
  - 선택 이유: SQL 쿼리문을 직접 작성하면 타입 세이프(Type-safe)한 Go 코드를 자동으로 생성해 줍니다. 런타임 에러를 줄이고 성능이 매우 뛰어납니다. (ORM의 복잡성 회피)

## 6. 인증 및 보안 (Authentication)
- **방식:** OAuth 2.0 기반 소셜 로그인
- **제공자:** **Google 로그인 서비스**

---
*문서 작성일: 2026-08-24*
