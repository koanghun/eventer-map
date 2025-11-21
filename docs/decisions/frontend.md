# 프론트엔드 결정

> 프론트엔드 라이브러리, 상태 관리, UI/UX 디자인에 관한 결정사항

---

## Q: Google Maps API 통합 라이브러리는?

**결정**: `@react-google-maps/api`

**이유**:
- React 공식 권장 라이브러리
- Hook 기반 현대적 API
- TypeScript 지원 우수
- 활발한 유지보수 및 커뮤니티
- 문서화 품질 높음

**대안**: google-map-react, react-google-maps
- **google-map-react**: 유지보수 중단, 구버전 React만 지원
- **react-google-maps**: 구버전 라이브러리, 클래스 컴포넌트 기반

**사용 예시**:
```typescript
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
```

**결과/영향**:
- 현대적인 Hook 패턴 사용
- TypeScript 자동완성 지원
- 유지보수성 향상

**날짜**: 2025-11-21

---

## Q: 상태 관리는 어떻게?

**결정**: useState + useEffect (로컬 상태 관리)

**이유**:
- 애플리케이션 규모가 작음 (5개 컴포넌트)
- 전역 상태 관리 불필요
- 컴포넌트 간 props로 충분
- 오버엔지니어링 방지

**상태 구조**:
```typescript
// App.tsx에서 관리
- selectedDate: string
- events: Event[]
- selectedEvent: Event | null
- isFormOpen: boolean
```

**대안**: Redux Toolkit, Zustand, Recoil
- 현재 규모에서는 과도함
- 학습 곡선 추가
- 보일러플레이트 코드 증가

**향후 계획**:
- 상태 복잡도 증가 시 (예: 사용자 인증, 복잡한 필터링) Zustand 도입 고려
- Redux Toolkit은 너무 무거움

**전환 시나리오**:
- 전역 상태가 5개 이상
- 여러 컴포넌트에서 동일 상태 접근
- props drilling이 3단계 이상

**날짜**: 2025-11-21

---

## Q: UI 디자인 방향은?

**결정**: 모던 그라데이션 디자인 + Glassmorphism

**이유**:
- 사용자에게 시각적으로 "WOW" 경험 제공
- 프리미엄 느낌
- 다크모드 미래 대응 가능

**디자인 원칙**:
- **색상**: 보라색 그라데이션 (#667eea → #764ba2)
- **카드**: border-radius 12px, 그림자 효과
- **애니메이션**: hover 시 transform, transition
- **반응형**: 모바일/태블릿/데스크톱 대응

**참고 사항**:
- Tailwind CSS 사용 안 함 (Vanilla CSS로 완전한 컨트롤)
- 일관된 디자인 토큰 사용
- 접근성(a11y) 고려

**날짜**: 2025-11-21

---

## Q: API 호출은 어떻게 관리하나요?

**결정**: Axios + 서비스 레이어 패턴

**구조**:
```
frontend/src/services/
└── api.ts  # 모든 API 호출 함수
```

**이유**:
- API 로직을 컴포넌트와 분리
- 재사용성 향상
- 테스트 용이
- baseURL 중앙 관리

**코드 예시**:
```typescript
export const eventApi = {
  getAllEvents: () => api.get<Event[]>('/events/'),
  createEvent: (data) => api.post<Event>('/events/', data),
  // ...
};
```

**대안**: fetch, React Query
- **fetch**: 에러 핸들링 불편, JSON 변환 수동
- **React Query**: 현재 규모에서는 과도함, 추후 캐싱 필요 시 고려

**날짜**: 2025-11-21
