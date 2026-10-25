---
name: develop-frontend-feature
description: >-
  Use this skill when developing or refactoring frontend UI features, pages, forms, tables, or state management in Eventer Map.
  Covers integrating Orval-generated TanStack Query v5 hooks, React Hook Form mutations,
  TanStack Table v8 and TanStack Virtual for large datasets, Zustand client stores, Tailwind CSS, and i18n.
---

# 🎨 프론트엔드 기능 개발 워크플로우 (Develop Frontend Feature)

Eventer Map 프론트엔드(`frontend/`)는 **API-First 자동 생성 코드(`Orval` + `TanStack Query v5`)**를 중심으로 서버 상태와 클라이언트 상태를 엄격히 분리하며, 대량 데이터 렌더링 및 폼 최적화를 위한 표준 스택을 사용합니다.

---

## 📋 핵심 아키텍처 원칙 (State & Data Separation)

1. **서버 상태 (Server State) ➔ `Orval` + `TanStack Query v5`**:
   - 모든 API 호출은 `frontend/src/api/generated/<tag>/`에 자동 생성된 Query/Mutation 훅만 사용합니다.
   - `axios`를 직접 호출하거나, API 응답 데이터를 `Zustand`나 `useState`에 복사하여 동기화하려 하지 마십시오.
2. **클라이언트 전역 상태 (Client UI State) ➔ `Zustand`**:
   - 지도에서 선택된 마커/이벤트(`useEventStore`), 토스트 알림(`useToastStore`), 사이드바/모달 개폐 여부 등 **순수 UI 상태만** `frontend/src/store/`에서 관리합니다.
3. **폼 상태 (Form State) ➔ `React Hook Form`**:
   - 입력 폼은 비제어 컴포넌트 기반인 `React Hook Form`으로 제어하여 타이핑 시 리렌더링을 최소화하고, 제출 시 Orval Mutation 훅(`mutate` / `mutateAsync`)을 호출합니다.
4. **대량 데이터 테이블 & 리스트 ➔ `TanStack Table v8` + `TanStack Virtual`**:
   - 정렬/필터/페이지네이션이 필요한 테이블은 Headless 구조인 `TanStack Table`을 사용하고, 수백 건 이상의 목록은 `TanStack Virtual`로 뷰포트 내 DOM만 렌더링합니다.

---

## 🛠️ 단계별 구현 가이드

### Step 1: API 훅 및 모델 타입 확인 (`src/api/generated/`)
1. 필요한 API가 이미 `src/api/generated/<tag>/`에 생성되어 있는지 확인합니다.
   - 없다면 먼저 `add-new-api` 스킬 절차에 따라 `backend/api/openapi.yaml`을 수정하고 `npm run generate:api`를 실행합니다.
2. DTO 및 엔티티 타입은 항상 `src/api/generated/model`에서 import하여 사용합니다.
   ```tsx
   import { useGetEvents, getGetEventsQueryKey } from '@/api/generated/events/events';
   import type { EventSummary } from '@/api/generated/model';
   ```

---

### Step 2: 데이터 조회 및 변경 (TanStack Query + React Hook Form)

1. **조회 (`useQuery`)**:
   - Orval이 생성한 `useGet*` 훅을 호출하고 `isLoading`, `isError`, `data` 상태를 기반으로 UI를 렌더링합니다.
2. **생성/수정/삭제 (`useMutation` + Query Invalidation)**:
   - Mutation 성공 시 `useQueryClient()`와 Orval이 생성한 `getGet*QueryKey()` 헬퍼를 사용해 관련 캐시를 무효화(Invalidate)합니다.
   ```tsx
   const queryClient = useQueryClient();
   const createEventMutation = usePostEvents({
     mutation: {
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
       },
     },
   });
   ```
3. **폼 연동 (`React Hook Form`)**:
   - `useForm<CreateEventRequest>()`으로 폼을 구성하고 `handleSubmit` 콜백에서 `createEventMutation.mutate({ data: formValues })`를 실행합니다.

---

### Step 3: 테이블 및 대량 리스트 최적화 (TanStack Table & Virtual)

1. **테이블 제어 (`TanStack Table v8`)**:
   - `createColumnHelper<T>()`로 컬럼을 정의하고 `useReactTable`로 정렬, 필터링, 행 선택 로직을 구성합니다.
   - 마크업은 Tailwind CSS 유틸리티 클래스로 자유롭게 스타일링합니다.
2. **가상 스크롤 (`TanStack Virtual`)**:
   - 대량 리스트나 테이블 본문 렌더링 시 `useVirtualizer`를 적용하여 현재 스크롤 영역(Viewport)에 보이는 아이템만 DOM에 마운트합니다.

---

### Step 4: 스타일링(Tailwind CSS) 및 다국어(i18n) 적용

1. **스타일링**:
   - `src/components/ui/`의 공통 프리미티브(Button, Dialog, Input, Select, Popover 등)를 우선 재사용합니다.
   - 조건부 클래스 병합 시 `src/lib/utils.ts`의 `cn()` 함수를 사용합니다.
2. **다국어 (i18next)**:
   - UI에 노출되는 텍스트는 하드코딩하지 않고 `useTranslation()`의 `t('key')`를 사용하며, `src/i18n/locales/{ko,ja,en,zh}.json`에 번역 키를 함께 추가합니다.

---

### Step 5: 검증 (Validation)

변경 사항 작성 후 TypeScript 컴파일 및 빌드에 문제가 없는지 확인합니다:
```bash
cd frontend
npx tsc --noEmit
```

