---
name: develop-frontend-feature
description: >-
  Use this skill when developing or refactoring frontend UI features, pages, forms, infinite lists, map interactions, or state management in Eventer Map.
  Covers integrating Orval-generated TanStack Query v5 hooks (useQuery, useInfiniteQuery, useMutation), React Compiler controlled state and sessionStorage drafts,
  debounce with IME guards, Zustand v5 client stores, Tailwind CSS + Radix UI, error localization, and i18n (ko, ja, en, zh).
---

# 🎨 프론트엔드 기능 개발 워크플로우 (Develop Frontend Feature)

Eventer Map 프론트엔드(`frontend/`)는 **API-First 자동 생성 코드(`Orval` + `TanStack Query v5`)**와 **React 18 + React Compiler (`craco.config.js`)**를 중심으로 서버 상태와 클라이언트 상태를 엄격히 분리합니다.

---

## 📋 핵심 아키텍처 원칙 (State & Data Separation)

1. **서버 상태 (Server State) ➔ `Orval` + `TanStack Query v5`**:
   - 모든 API 호출은 `frontend/src/api/generated/<tag>/`에 자동 생성된 Query/Mutation 훅 및 API 함수만 사용합니다.
   - `axios`를 직접 호출하거나, API 응답 데이터를 `Zustand`나 `useState`에 복사하여 수동 동기화하려 하지 마십시오.
2. **클라이언트 전역 상태 (Client UI State) ➔ `Zustand (v5)`**:
   - 선택된 이벤트(`selectedEvent`), 지도 뷰포트/이동 타깃(`mapBounds`, `mapCenterTarget`), 회장 좌표 피킹 상태(`isPickingVenueLocation`, `venueDraftLocation`), 토스트 알림(`useToastStore`) 등 **순수 클라이언트 상태만** `frontend/src/store/`에서 관리합니다.
3. **컴포넌트 상태 & 폼 제어 ➔ `React Compiler` + `useState` (+ `sessionStorage`)**:
   - `babel-plugin-react-compiler`가 활성화되어 있으므로 불필요한 수동 메모이제이션을 지양하고, 깔끔한 제어 컴포넌트(`useState`)로 폼을 구현합니다.
   - 입력 손실 방지가 필요한 긴 폼은 `EventFormPane.tsx`처럼 `sessionStorage` 드래프트 보존 패턴을 활용합니다. (`React Hook Form`, `TanStack Table`, `TanStack Virtual`은 프로젝트에 미설치되어 있으며 사용하지 않습니다.)
4. **Import 경로 규칙**:
   - `frontend/tsconfig.json`에는 `"baseUrl": "src"`만 설정되어 있고 `@/*` 경로 별칭이 없습니다. **반드시 상대 경로(`../../api/generated/...` 등)로 import** 하세요.

---

## 🛠️ 단계별 구현 가이드

### Step 1: API 훅 및 모델 타입 확인 (`src/api/generated/`)
1. 필요한 API가 이미 `src/api/generated/<tag>/`에 생성되어 있는지 확인합니다.
   - 없다면 먼저 `add-new-api` 스킬 절차에 따라 `backend/api/openapi.yaml`을 수정하고 `npm run generate:api`를 실행합니다.
2. DTO 및 엔티티 타입은 항상 `src/api/generated/model`에서 상대 경로로 import하여 사용합니다.
   ```tsx
   import { useGetEvents, getGetEventsQueryKey } from '../../api/generated/events/events';
   import type { EventSummary } from '../../api/generated/model';
   ```

---

### Step 2: 데이터 조회, 자동완성, 무한 스크롤 및 변경

1. **기본 조회 (`useQuery`)**:
   - Orval이 생성한 `useGet*` 훅을 호출하고 `isLoading`, `isError`, `data` 상태를 기반으로 UI를 렌더링합니다.
2. **자동완성 검색 (`useDebounce` + IME 가드 + `staleTime`)**:
   - 출연자/공연장 자동완성 구현 시 `use-debounce`(`300ms`), 한글·일본어 IME 조합 가드(`!isComposing`), `staleTime: 5 * 60 * 1000`을 적용해 불필요한 API 호출을 방지합니다 (`ArtistSearch.tsx`, `EventFormPane.tsx` 패턴).
   ```tsx
   const [query, setQuery] = useState('');
   const [debouncedQuery] = useDebounce(query.trim(), 300);
   const [isComposing, setIsComposing] = useState(false);

   const { data } = useGetVenuesSearch(
     { query: debouncedQuery, limit: 10 },
     {
       query: {
         enabled: !isComposing && debouncedQuery.length >= 1,
         staleTime: 5 * 60 * 1000,
         gcTime: 10 * 60 * 1000,
       },
     }
   );
   ```
3. **커서 기반 무한 스크롤 (`useInfiniteQuery`)**:
   - 대량 목록(스레드 등)은 Orval이 생성한 API 함수(`listEventThreads` 등)와 쿼리 키 헬퍼(`getListEventThreadsQueryKey`)를 `useInfiniteQuery`와 결합합니다 (`EventThreadSection.tsx` 패턴).
   ```tsx
   const threadsQueryKey = getListEventThreadsQueryKey(eventId, { limit: 20 });
   const threadsQuery = useInfiniteQuery({
     queryKey: threadsQueryKey,
     queryFn: ({ pageParam, signal }) =>
       listEventThreads(eventId, { limit: 20, cursor: pageParam }, undefined, signal),
     initialPageParam: undefined as string | undefined,
     getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
     enabled: !!eventId,
   });
   ```
4. **생성/수정/삭제 (`useMutation` + Query Invalidation & 에러 처리)**:
   - Mutation 성공 시 `useQueryClient()`와 `getGet*QueryKey()` 헬퍼로 관련 캐시를 무효화합니다. (이벤트 생성/수정이나 아티스트 팔로우 변경 시 알림 피드 캐시 `getGetUsersMeFollowingArtistsEventsQueryKey()`도 함께 무효화합니다.)
   - 로그아웃/탈퇴 시 개인화 캐시 정리 규칙(`AuthContext.tsx`의 `clearPrivateClientState()`)과 일관되도록 `/users/me*` 또는 개인화 쿼리 키 규칙을 유지합니다.
   - **에러 토스트 처리**: `src/lib/axios.ts` 인터셉터가 403/5xx/네트워크 에러에 대해 이미 토스트를 표시하고 `error._toastShown = true`를 설정합니다. 컴포넌트 `onError`/`catch`에서는 `toast.error(...)`를 직접 부르지 말고 **`toast.apiError(err, fallbackMessage)`**(`src/store/useToastStore.ts`)를 사용해 중복 토스트를 방지하고 `errors.api.<code>` 다국어 메시지를 우선 표시하세요.
   ```tsx
   const queryClient = useQueryClient();
   const createEventMutation = usePostEvents({
     mutation: {
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
         queryClient.invalidateQueries({ queryKey: getGetUsersMeFollowingArtistsEventsQueryKey() });
       },
       onError: (err) => {
         toast.apiError(err, t('errors.saveFailed'));
       },
     },
   });
   ```

---

### Step 3: 지도, UI 프리미티브 & 다국어 (i18n) 적용

1. **UI 프리미티브 & 스타일링**:
   - `src/components/ui/`의 공통 프리미티브(Button, Dialog, Input, Select, Popover, Calendar 등)와 `src/components/common/` 공용 컴포넌트를 우선 재사용합니다.
   - 조건부 클래스 병합 시 `src/lib/utils.ts`의 `cn()` 함수를 사용합니다.
   - 지도 기능은 `@react-google-maps/api`를 사용하며, 장소 검색·역지오코딩 시 Google Places/Geocoder 실패에 대비한 OpenStreetMap Nominatim 폴백 패턴(`VenueFormPane.tsx`)을 유지합니다.
2. **다국어 (`i18next`)**:
   - UI에 노출되는 텍스트는 하드코딩하지 않고 `useTranslation()`의 `t('key')`를 사용하며, **`src/i18n/locales/{ko,ja,en,zh}.json` 4개 언어 파일을 모두** 동일 키 구조로 업데이트합니다.
   - 백엔드에서 새 `RespondErrorCode`를 추가한 경우 4개 언어 파일의 `errors.api.<CODE>`도 함께 추가합니다.

---

### Step 4: 검증 (Validation)

변경 사항 작성 후 TypeScript 타입 체크 및 테스트에 문제가 없는지 확인합니다:
```bash
cd frontend
npx tsc --noEmit
```
관련 Jest/Testing Library 테스트가 있거나 추가한 경우 함께 실행합니다:
```bash
cd frontend
CI=true npm test -- --watchAll=false
```
