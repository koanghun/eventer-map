# 🚀 Orval 라이브러리 가이드 및 사용 설명서

[⬅️ 홈으로 돌아가기](./Home.md) | [관련 문서: API 상세 설계서](./API_SPECIFICATION.md)

본 문서는 Eventer Map 프로젝트의 프론트엔드에서 API 클라이언트를 자동화하기 위해 도입된 **Orval** 라이브러리에 대한 사용 가이드입니다.

---

## 1. Orval 이란?
[Orval](https://orval.dev/)은 OpenAPI 명세서(`backend/api/openapi.yaml`)를 기반으로 **TypeScript 타입 모델**과 **HTTP 통신 함수(Axios)**, 그리고 **TanStack Query (React Query v5) 훅**을 자동으로 생성해 주는 도구입니다.

### 도입 효과
- **E2E 타입 안정성**: 백엔드의 `openapi.yaml` 스키마 변경 사항(예: `Artist`의 `disambiguation` 추가, `VenueSummary`의 `address` 추가 등)이 프론트엔드 TypeScript 코드에 즉시 반영됩니다.
- **수동 코딩 제거**: 수동으로 Axios 호출 함수를 작성하지 않으며, `src/api/generated/` 하위 파일은 오직 생성 스크립트로만 갱신합니다.

---

## 2. API 생성 스크립트 실행 방법

`backend/api/openapi.yaml`이 변경되었을 때 `frontend` 디렉터리에서 다음 명령어를 실행합니다:

```bash
cd frontend
npm run generate:api
```

명령어가 실행되면 `frontend/src/api/generated/` 하위에 태그별 폴더(`artists/`, `venues/`, `events/`, `threads/`, `auth/`, `user/` 등)와 `model/` 타입 파일들이 자동 갱신됩니다.

---

## 3. 생성된 TanStack Query 훅 사용법

`src/lib/axios.ts`의 `customInstance`가 `response.data`를 바로 반환하므로, 훅의 `data`에는 실제 응답 페이로드가 직접 담깁니다.

### 📌 1) 자동완성 검색 조회 (`GET`) - `useGetVenuesSearch` / `useGetArtists`
디바운스(`useDebounce`)와 `enabled`, `staleTime` 옵션을 결합하여 서버 부하 없이 자동완성을 구현합니다.

```tsx
import { useDebounce } from 'use-debounce';
import { useGetVenuesSearch } from '../../api/generated/venues/venues';

const [venueQuery, setVenueQuery] = useState('');
const [debouncedVenueQuery] = useDebounce(venueQuery.trim(), 300);

const { data: rawVenueResults, isFetching } = useGetVenuesSearch(
  { query: debouncedVenueQuery, limit: 10 },
  {
    query: {
      enabled: debouncedVenueQuery.length >= 1,
      staleTime: 5 * 60 * 1000, // 5분간 동일 검색어 재요청 방지
    },
  }
);
const venueResults = Array.isArray(rawVenueResults) ? rawVenueResults : [];
```

### 📌 2) 데이터 등록 (`POST`) - `usePostVenues` / `usePostArtists` / `usePostEvents`
- `POST /venues`, `POST /events` 등 JSON 요청과 `POST /artists` 같은 `multipart/form-data`(파일 업로드 포함) 요청 모두 Orval이 자동으로 직렬화 코드를 생성해 줍니다.

```tsx
import { usePostArtists, getGetArtistsQueryKey } from '../../api/generated/artists/artists';
import { ArtistInputGender } from '../../api/generated/model';

const queryClient = useQueryClient();
const { mutateAsync: createArtist, isPending } = usePostArtists();

const handleCreate = async () => {
  const created = await createArtist({
    data: {
      officialName: 'Perfume',
      hiragana: 'ぱふゅーむ',
      disambiguation: '3인조 테크노 팝 유닛',
      gender: ArtistInputGender.FEMALE,
      profileImage: file, // File 객체 전달 시 자동으로 FormData로 변환됨
    },
  });
  queryClient.invalidateQueries({ queryKey: getGetArtistsQueryKey() });
};
```

### 📌 3) 커서 무한 스크롤 (`useInfiniteQuery`) & 낙관적 업데이트 - `threads/threads`
Orval이 생성한 API 함수(`listEventThreads`)와 쿼리 키 헬퍼(`getListEventThreadsQueryKey`)를 TanStack Query v5의 `useInfiniteQuery`와 결합하여 무한 스크롤을 구현하고, 추천 토글(`useRecommendEventThread`, `useUnrecommendEventThread`) 시 즉시 UI를 업데이트하는 낙관적 업데이트 패턴을 적용합니다.

```tsx
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  listEventThreads,
  getListEventThreadsQueryKey,
  useCreateEventThread,
  useRecommendEventThread,
} from '../../api/generated/threads/threads';
import type { EventThreadListResponse } from '../../api/generated/model';

// 1. 무한 스크롤 쿼리
const threadsQueryKey = getListEventThreadsQueryKey(eventId, { limit: 20 });
const threadsQuery = useInfiniteQuery({
  queryKey: threadsQueryKey,
  queryFn: ({ pageParam, signal }) =>
    listEventThreads(eventId, { limit: 20, cursor: pageParam }, undefined, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage: EventThreadListResponse) => lastPage.nextCursor ?? undefined,
  enabled: !!eventId,
});

// 2. 추천 낙관적 업데이트
const queryClient = useQueryClient();
const recommendMutation = useRecommendEventThread({
  mutation: {
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: threadsQueryKey });
      const prev = queryClient.getQueryData(threadsQueryKey);
      // 캐시 내 카운트 및 추천 상태 즉시 반영
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(threadsQueryKey, context.prev);
    },
  },
});
```

### 📌 4) URL 쿼리 기반 개인화 필터 조회 & 캐시 격리 (`useGetEvents`)
`openapi.yaml`의 `GET /events` enum/boolean 파라미터가 Orval을 통해 `GetEventsMyAction` 상수·타입 및 `GetEventsParams.followingArtists`로 자동 생성되므로, `MapPage.tsx`와 `AuthContext.tsx`에서 타입 안전하게 필터링과 비공개 캐시 정리를 수행할 수 있습니다.

```tsx
import { useGetEvents, getGetEventsQueryKey } from '../../api/generated/events/events';
import { GetEventsMyAction } from '../../api/generated/model';

const { data } = useGetEvents({
  myAction: isMyAction ? GetEventsMyAction.bookmarked : undefined,
  followingArtists: isFollowingArtists ? true : undefined,
  startDate,
  endDate,
  limit: 100,
});

// 로그아웃/회원 탈퇴 시 개인화 이벤트 캐시(myAction, followingArtists) 제거 예시
queryClient.removeQueries({
  predicate: (query) => {
    const key = query.queryKey;
    if (!Array.isArray(key) || key[0] !== '/events') return false;
    const params = key[1] as { myAction?: unknown; followingArtists?: unknown } | undefined;
    return Boolean(params?.myAction || params?.followingArtists);
  },
});
```

---

## 4. 커스텀 설정 (`frontend/orval.config.js`)

```javascript
module.exports = {
  'eventer-map-api': {
    input: '../backend/api/openapi.yaml',
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/endpoints.ts',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      override: {
        mutator: {
          path: 'src/lib/axios.ts',
          name: 'customInstance',
        },
      },
    },
  },
};
```

> [!IMPORTANT]
> `src/api/generated/` 내부의 파일들은 `npm run generate:api` 실행 시 덮어써지므로 **절대 직접 수정하지 마십시오.**
