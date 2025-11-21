# 아키텍처 결정

> 프로젝트의 전체 아키텍처 및 프레임워크 선택에 관한 결정사항

---

## Q: 왜 FastAPI를 선택했나요?

**결정**: FastAPI 사용

**이유**:
- 고성능 비동기 처리 (Uvicorn + ASGI)
- 자동 API 문서 생성 (Swagger UI)
- Pydantic을 통한 강력한 데이터 검증
- Python 타입 힌팅 지원
- 빠른 개발 속도

**대안**: Django REST Framework, Flask
- Django는 과도하게 무겁고 ORM이 복잡
- Flask는 비동기 지원이 약함

**결과/영향**:
- 개발 속도 향상
- 자동 문서화로 API 테스트 용이
- 비동기 처리로 확장성 확보

**날짜**: 2025-11-21

---

## Q: 프론트엔드는 왜 React + TypeScript인가요?

**결정**: React 18 + TypeScript

**이유**:
- **React**: 컴포넌트 기반, 풍부한 생태계, Google Maps API 라이브러리 지원
- **TypeScript**: 타입 안정성, 런타임 오류 사전 방지, 개발 생산성 향상
- 팀 요구사항에 부합

**대안**: Vue, Angular, Svelte
- Vue/Angular: 러닝 커브, 생태계
- Svelte: Google Maps 통합 라이브러리 제한

**결과/영향**:
- 타입 안정성으로 버그 감소
- Google Maps 통합 라이브러리 품질 우수
- 개발자 경험 향상

**날짜**: 2025-11-21

---

## Q: 전체 시스템 아키텍처는?

**결정**: 3-tier 아키텍처 (프론트엔드 - 백엔드 - 데이터베이스)

**구조**:
```
┌─────────────────┐
│   Frontend      │  React + TypeScript
│   (Nginx)       │  Google Maps API
└────────┬────────┘
         │ HTTP/REST
┌────────┴────────┐
│   Backend       │  FastAPI + Uvicorn
│   (Python)      │  SQLAlchemy ORM
└────────┬────────┘
         │
┌────────┴────────┐
│   Database      │  SQLite
│                 │  (PostgreSQL 전환 가능)
└─────────────────┘
```

**이유**:
- 관심사의 분리 (Separation of Concerns)
- 독립적인 확장 가능
- 유지보수 용이

**날짜**: 2025-11-21
