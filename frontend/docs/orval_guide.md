# 🚀 Orval 라이브러리 가이드 및 사용 설명서

본 문서는 Eventer Map 프로젝트의 프론트엔드에서 API 클라이언트를 자동화하기 위해 도입된 **Orval** 라이브러리에 대한 사용 가이드입니다.

---

## 1. Orval 이란?
[Orval](https://orval.dev/)은 OpenAPI(Swagger) 명세서(`.yaml` 또는 `.json`)를 기반으로 **TypeScript 타입 모델**과 **HTTP 통신 함수(Axios)**, 그리고 **React Query 훅**을 자동으로 생성해 주는 강력한 도구입니다.

### 도입 효과
- **완벽한 타입 안정성**: 백엔드의 스키마 변경 사항(타입 추가, 컬럼명 변경)이 프론트엔드 타입스크립트 코드에 즉시 반영됩니다.
- **수동 코딩 제거**: 수동으로 Axios 함수를 만들고 URL, 쿼리 파라미터를 맞추는 반복 작업이 사라집니다.
- **React Query 찰떡궁합**: `useQuery`, `useMutation` 훅이 자동으로 만들어지므로 컴포넌트 내에서 바로 데이터를 가져오고 상태 관리를 할 수 있습니다.

---

## 2. API 생성 스크립트 실행 방법

백엔드의 명세(`backend/api/openapi.yaml`)가 변경되었거나, 처음 프로젝트를 설정할 때는 아래 명령어를 통해 최신 코드를 생성해야 합니다.

프론트엔드(`frontend`) 디렉터리에서 터미널을 열고 다음 명령어를 실행하세요:

```bash
# 1. npm 스크립트로 실행 (추천)
npm run generate:api

# 2. npx로 직접 실행
npx orval
```

명령어가 성공적으로 실행되면, `frontend/src/api/generated/` 디렉터리에 각 도메인별(artists, auth, events 등)로 폴더가 생성되고 훅과 타입 파일들이 업데이트됩니다.

---

## 3. 생성된 React Query 훅 사용법

Orval은 백엔드의 `operationId`를 기반으로 카멜케이스(Camel Case) 형태의 훅을 생성합니다.

### 📌 데이터 조회 (GET) - `useQuery`
`GET` 요청은 `use{OperationId}` 형태의 훅으로 생성됩니다.

```tsx
import { useGetEvents } from '@/api/generated/events/events';

function EventList() {
  // 생성된 훅을 임포트하여 사용 (로딩 상태, 에러, 데이터 모두 자동 제공)
  const { data, isLoading, isError } = useGetEvents({
    // 파라미터가 필요한 경우 객체 형태로 넘깁니다. 타입 추론이 자동으로 됩니다!
    page: 1,
    limit: 10
  });

  if (isLoading) return <div>로딩 중...</div>;
  if (isError) return <div>에러 발생</div>;

  return (
    <ul>
      {/* data 에는 Axios 응답이 담겨 있으며, 통상 data.data 안에 실제 응답이 있습니다. */}
      {data?.data.map(event => (
        <li key={event.id}>{event.title}</li>
      ))}
    </ul>
  );
}
```

### 📌 데이터 변경 (POST, PUT, DELETE) - `useMutation`
`POST`, `PUT`, `DELETE` 요청은 데이터를 변경하는 행위이므로, 접미사나 접두어에 맞추어 뮤테이션 훅으로 생성됩니다.

```tsx
import { usePostAuthSignup } from '@/api/generated/auth/auth';

function SignupForm() {
  // useMutation 기반의 훅
  const signupMutation = usePostAuthSignup();

  const handleSignup = () => {
    signupMutation.mutate({
      data: {
        email: "test@test.com",
        nickname: "test_user",
        password: "Password123"
      }
    }, {
      onSuccess: (response) => {
        alert('가입 성공!');
      },
      onError: (error) => {
        // Axios 에러를 캐치합니다.
        console.error('가입 실패', error.response?.data);
      }
    });
  };

  return <button onClick={handleSignup}>가입하기</button>;
}
```

---

## 4. 커스텀 설정 (`orval.config.js`)

프론트엔드 루트에 있는 `orval.config.js`가 Orval의 동작 방식을 결정합니다.

```javascript
module.exports = {
  'eventer-map-api': {
    input: '../backend/api/openapi.yaml', // OpenAPI 명세 파일 경로
    output: {
      mode: 'tags-split', // 태그별로 폴더를 나누어 생성
      target: 'src/api/generated/endpoints.ts',
      schemas: 'src/api/generated/model', // 타입 모델 파일들이 위치할 곳
      client: 'react-query', // React Query 훅 생성 지정
      override: {
        mutator: {
          // 중요: 자동 생성되는 훅들이 공통적으로 사용할 Axios 인스턴스 지정
          path: 'src/lib/axios.ts', 
          name: 'customInstance',
        },
      },
    },
  },
};
```
> [!NOTE] 
> `src/lib/axios.ts`의 `customInstance`에는 헤더에 인증 토큰(Bearer)을 자동으로 심어주는 인터셉터 로직이 들어가 있습니다. 따라서 Orval이 생성한 훅을 사용하면 로그인 토큰 처리도 자동으로 이뤄집니다.

---

## 5. 자주 묻는 질문 (FAQ)

**Q. API 요청을 보내면 컴파일(타입) 에러가 납니다.**
A. 백엔드 `openapi.yaml`에 정의된 파라미터(필수 여부, 타입)와 다르게 넘겼을 확률이 높습니다. 자동 완성(Ctrl + Space)을 활용하여 요구하는 속성을 확인하세요.

**Q. 특정 컴포넌트에서만 API URL을 바꾸고 싶어요.**
A. 환경 변수(`.env`의 `REACT_APP_API_URL`)를 수정하거나, `src/lib/axios.ts`에 정의된 baseURL 로직을 변경하면 전체 생성된 API에 일괄 적용됩니다.

**Q. 백엔드에서 새로운 API를 추가했습니다. 어떻게 반영하나요?**
A. 백엔드 개발자가 `openapi.yaml`을 업데이트한 뒤, 프론트엔드에서 `npm run generate:api`만 실행해주면 새로운 훅이 짠! 하고 나타납니다.
