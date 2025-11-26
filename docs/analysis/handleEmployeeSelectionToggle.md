# handleEmployeeSelectionToggle 함수 설명

## 개요

`handleEmployeeSelectionToggle` 함수는 `ProjectManager` 컴포넌트 내에서 특정 직원의 선택 상태를 토글(toggle)하는 역할을 합니다. 즉, 직원을 선택하거나 선택 해제할 때 호출됩니다.

---

## 함수 코드

```typescript
const handleEmployeeSelectionToggle = (employeeId: number) =>
  setSelectedEmployeeIds(prev =>
    prev.includes(employeeId)
      ? prev.filter(id => id !== employeeId)
      : [...prev, employeeId]
  );
```

---

## 매개변수

- **employeeId: number**: 선택 상태를 변경할 직원의 고유 ID(숫자)입니다.

---

## 기능

1. **상태 업데이트 함수 호출**: `setSelectedEmployeeIds` 함수(useState 훅으로 관리되는 `selectedEmployeeIds` 상태를 업데이트하는 함수)를 호출합니다.

2. **업데이트 함수 방식**: `setSelectedEmployeeIds`에 업데이트 함수를 전달하여 이전 상태(`prev`)를 기반으로 새로운 상태를 계산합니다. 이는 React에서 상태를 안전하게 업데이트하는 권장 방식입니다.

---

## 내부 로직

### 조건 검사: `prev.includes(employeeId)`

현재 `selectedEmployeeIds` 배열(`prev`)에 `employeeId`가 이미 포함되어 있는지 확인합니다.

#### ✅ employeeId가 이미 포함된 경우 (참, `?` 다음 코드 실행)

```typescript
prev.filter(id => id !== employeeId)
```

- `employeeId`를 제외한 모든 요소를 포함하는 새로운 배열을 생성합니다.
- 이는 해당 직원을 **선택 해제**하는 동작에 해당합니다.

#### ❌ employeeId가 포함되지 않은 경우 (거짓, `:` 다음 코드 실행)

```typescript
[...prev, employeeId]
```

- `prev` 배열의 모든 요소(`...prev`)와 새로운 `employeeId`를 포함하는 새로운 배열을 생성합니다.
- 이는 해당 직원을 **선택**하는 동작에 해당합니다.

---

## 요약

`handleEmployeeSelectionToggle` 함수는 주어진 `employeeId`를 `selectedEmployeeIds` 배열에 추가하거나 제거함으로써 직원의 선택 상태를 변경합니다. 이 함수는 React의 불변성(immutability) 원칙을 따라 항상 새로운 배열을 반환하여 상태를 업데이트합니다.

---

## 사용 예시

```typescript
// 직원 ID 1번을 선택
handleEmployeeSelectionToggle(1);

// selectedEmployeeIds가 []이었다면 → [1]로 변경

// 다시 직원 ID 1번을 선택 해제
handleEmployeeSelectionToggle(1);

// selectedEmployeeIds가 [1]이었다면 → []로 변경

// 여러 직원 선택
handleEmployeeSelectionToggle(1);  // [1]
handleEmployeeSelectionToggle(2);  // [1, 2]
handleEmployeeSelectionToggle(3);  // [1, 2, 3]
handleEmployeeSelectionToggle(2);  // [1, 3] (2번 제거)
```

---

---

# React의 불변성(Immutability) 원칙

## 질문: 새로운 배열을 생성하는 것이 정말 효율적일까?

> "배열에서 빼는게 아니라 아예 새로운 배열을 생성한다고? 메모리 시점에서 무척 안좋은 코드 같은데?"

네, 메모리 관점에서 보면 기존 배열을 직접 수정(mutate)하는 것이 더 효율적으로 보일 수 있습니다. 이는 아주 좋은 질문이며, React의 핵심 동작 원리와 관련된 중요한 부분입니다.

---

## 결론

**새로운 배열을 생성하는 것이 React에서는 올바른 방법이며, 오히려 더 많은 이점을 가져옵니다.**

---

## 이유: React의 상태 변경 감지 방식

React는 컴포넌트를 언제 다시 렌더링할지 결정하기 위해, 상태(state)가 변경되었는지를 확인합니다. 이 확인 작업은 **얕은 비교(shallow comparison)**를 통해 이루어집니다.

즉, **이전 상태와 새로운 상태의 메모리 주소(참조)가 다른지를 비교**합니다.

---

## 케이스 1: 기존 배열을 직접 수정할 경우 (❌ 잘못된 방법)

```typescript
const handleWrongUpdate = (employeeId) => {
  setSelectedEmployeeIds(prev => {
    // 'prev' 배열을 직접 수정
    const index = prev.indexOf(employeeId);
    if (index > -1) {
      prev.splice(index, 1); // 배열에서 제거
    } else {
      prev.push(employeeId); // 배열에 추가
    }
    return prev; // 내용은 바뀌었지만 주소는 그대로인 배열 반환
  });
};
```

### 문제점

`.push()`, `.pop()`, `.splice()` 등을 사용해 기존 배열을 직접 수정하면:
- 배열의 **내용은 바뀌지만** 배열 자체가 담겨있는 **메모리 주소는 동일하게 유지**됩니다.
- React는 이전 상태와 다음 상태의 메모리 주소를 비교하고, 주소가 같으므로 "아, 아무것도 바뀌지 않았네"라고 판단합니다.
- 결과적으로 **컴포넌트를 다시 렌더링하지 않습니다.**
- 데이터는 변경되었지만 화면에는 반영되지 않는 **버그가 발생**합니다.

### 메모리 주소 예시

```
이전 상태: [1, 2, 3] (메모리 주소: 0x001)
직접 수정 후: [1, 2] (메모리 주소: 0x001) ← 같은 주소!

React: "상태가 변경되지 않았다" → 렌더링 안 함 ❌
```

---

## 케이스 2: 새로운 배열을 생성할 경우 (✅ 올바른 방법)

```typescript
const handleEmployeeSelectionToggle = (employeeId) => {
  setSelectedEmployeeIds(prev =>
    prev.includes(employeeId)
      ? prev.filter(id => id !== employeeId) // 새로운 배열 생성
      : [...prev, employeeId]                // 새로운 배열 생성
  );
};
```

### 장점

`filter()`, `map()`, 전개 구문(`...`) 등을 사용하면 **항상 새로운 메모리 주소를 가진 새로운 배열이 생성**됩니다.

- React는 이전 상태와 다음 상태의 메모리 주소가 다르다는 것을 **즉시 감지**합니다.
- "상태가 변경되었구나!"라고 판단하여 **컴포넌트를 다시 렌더링**합니다.
- 결과적으로 **화면이 올바르게 업데이트**됩니다.

### 메모리 주소 예시

```
이전 상태: [1, 2, 3] (메모리 주소: 0x001)
새로운 배열 생성: [1, 2] (메모리 주소: 0x002) ← 다른 주소!

React: "상태가 변경되었다" → 렌더링 함 ✅
```

---

## 메모리와 성능에 대한 우려

### 메모리 비용

말씀하신 것처럼 새로운 배열을 만드는 것은 **아주 약간의 메모리를 더 사용**합니다. 하지만:

- 현대의 JavaScript 엔진은 이러한 작업에 **매우 최적화**되어 있습니다.
- 대부분의 애플리케이션에서는 이 비용이 **무시할 수 있을 정도로 작습니다.**

### 성능상의 이점 (훨씬 큼!)

오히려, **불변성(Immutability, 원본을 수정하지 않고 새로운 객체를 만드는 것)을 유지**함으로써 얻는 성능상의 이점이 훨씬 큽니다.

#### 1. 변화 감지가 매우 빠름

```
❌ 불변성을 지키지 않을 때:
- 배열의 모든 요소를 일일이 비교해야 함
- O(n) 시간 복잡도

✅ 불변성을 유지할 때:
- 메모리 주소만 비교하면 됨
- O(1) 시간 복잡도 (매우 빠름!)
```

#### 2. 성능 최적화 가능

React는 이 빠른 변화 감지를 이용해 `React.memo`와 같은 최적화 기법을 제공합니다.

```typescript
// React.memo를 사용한 최적화
const EmployeeList = React.memo(({ selectedEmployeeIds }) => {
  // selectedEmployeeIds가 변경되지 않으면 이 컴포넌트는 렌더링되지 않음
  return (
    <ul>
      {selectedEmployeeIds.map(id => (
        <li key={id}>Employee {id}</li>
      ))}
    </ul>
  );
});
```

이를 통해 상태가 변경되지 않은 컴포넌트의 불필요한 렌더링을 건너뛰어 **전체적인 성능을 향상**시킬 수 있습니다.

---

## 실제 성능 비교

### 코드 1: 불변성을 지키지 않은 경우 (버그 발생)

```typescript
const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

const handleWrongUpdate = (employeeId) => {
  setSelectedEmployeeIds(prev => {
    prev.push(employeeId); // 직접 수정
    return prev;
  });
};

// 결과: 데이터는 변경되었지만 화면에는 반영되지 않음
```

### 코드 2: 불변성을 유지한 경우 (올바름)

```typescript
const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

const handleEmployeeSelectionToggle = (employeeId) => {
  setSelectedEmployeeIds(prev =>
    prev.includes(employeeId)
      ? prev.filter(id => id !== employeeId)
      : [...prev, employeeId]
  );
};

// 결과: 데이터 변경 + 화면 업데이트 (정상 작동)
```

---

## 요약

### React에서는 상태를 직접 수정하는 대신 항상 새로운 객체나 배열을 생성하여 상태를 업데이트해야 합니다.

이는:
- ✅ **예측 가능한 상태 관리**를 가능하게 합니다.
- ✅ **UI 업데이트**가 올바르게 반영됩니다.
- ✅ **더 나은 성능 최적화**를 가능하게 합니다.

약간의 메모리 비용을 감수하더라도, React의 핵심적인 패턴이자 모범 사례(Best Practice)입니다.

---

## 참고: 불변성이 중요한 다른 상황들

### 1. 객체 상태 업데이트

```typescript
// ❌ 잘못된 예
const [user, setUser] = useState({ name: 'John', age: 30 });

const updateName = (newName) => {
  user.name = newName; // 직접 수정
  setUser(user);       // 메모리 주소 같음 → 렌더링 안 됨
};

// ✅ 올바른 예
const updateName = (newName) => {
  setUser({ ...user, name: newName }); // 새로운 객체 생성
};
```

### 2. 중첩된 배열/객체

```typescript
// ❌ 잘못된 예
const [todos, setTodos] = useState([
  { id: 1, title: 'Task 1', done: false }
]);

const toggleTodo = (id) => {
  const todo = todos.find(t => t.id === id);
  todo.done = !todo.done; // 직접 수정
  setTodos(todos);        // 메모리 주소 같음 → 렌더링 안 됨
};

// ✅ 올바른 예
const toggleTodo = (id) => {
  setTodos(todos.map(todo =>
    todo.id === id ? { ...todo, done: !todo.done } : todo
  ));
};
```

---

## 추가 학습: Immer 라이브러리

대규모 중첩 구조에서는 불변성을 유지하기가 복잡해질 수 있습니다. 이 경우 **Immer** 라이브러리를 사용하면 편리합니다.

```typescript
import produce from 'immer';

const [state, setState] = useState({ ... });

// Immer를 사용하면 직접 수정하는 것처럼 보이지만 불변성이 유지됨
setState(produce(draft => {
  draft.someNested.value = newValue; // 직접 수정처럼 보임
  // 내부적으로는 새로운 객체 생성
}));
```

하지만 일반적인 경우에는 표준 JavaScript 메서드(`filter()`, `map()`, 전개 구문 등)를 사용하는 것이 권장됩니다.