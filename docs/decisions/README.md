# 기술 결정 인덱스

> 프로젝트의 중요한 기술적 결정사항을 주제별로 분류하여 기록합니다.

## 📚 주제별 문서

### [아키텍처 결정](./architecture.md)
- 프레임워크 선택 (FastAPI, React + TypeScript)
- 전체 시스템 구조
- 컴포넌트 간 통신

### [데이터베이스](./database.md)
- 데이터베이스 선택 (SQLite vs PostgreSQL)
- 데이터 모델 설계
- 날짜/시간 필드 형식

### [프론트엔드](./frontend.md)
- Google Maps API 라이브러리 선택
- 상태 관리 전략
- UI/UX 디자인 결정

### [인프라/배포](./infrastructure.md)
- Docker 사용 이유
- Multi-stage Build 전략
- Nginx 설정
- Synology NAS 배포

### [최적화](./optimization.md)
- Google Maps API 비용 최적화
- 성능 개선 전략
- 캐싱 전략

---

## 🔍 빠른 참조

### 자주 참조하는 결정
1. **Google Maps API 최적화**: [optimization.md](./optimization.md)
2. **데이터베이스 선택**: [database.md](./database.md#sqlite-vs-postgresql)
3. **Docker 구성**: [infrastructure.md](./infrastructure.md)

---

## 📝 새 결정사항 추가 방법

1. 적절한 주제의 문서 파일 선택
2. Q&A 형식으로 작성:
   ```markdown
   ### Q: [질문]
   
   **결정**: [결정 사항]
   
   **이유**:
   - 이유 1
   - 이유 2
   
   **대안**: [고려한 대안]
   - 대안의 장단점
   
   **결과/영향**:
   - 이 결정의 영향
   
   **날짜**: YYYY-MM-DD
   ```
3. 이 인덱스에서 자주 참조하는 결정 업데이트

---

## 📊 결정 통계

- **총 결정 건수**: 11개
- **마지막 업데이트**: 2025-11-21
- **주요 카테고리**: 아키텍처(2), 데이터베이스(2), 프론트엔드(2), 인프라(3), 최적화(2)
