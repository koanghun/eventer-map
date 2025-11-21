# Event Map 프로젝트 문서

이 디렉토리에는 Event Map 프로젝트의 모든 문서가 포함되어 있습니다.

## 📚 핵심 문서

### 1. [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) ⭐
**프로젝트 전체 개요**
- 프로젝트 목표 및 핵심 기능
- 기술 스택 및 아키텍처
- UI/UX 특징
- Google Maps API 최적화 전략

👉 **이 문서를 가장 먼저 읽으세요!** 프로젝트의 전체 그림을 파악할 수 있습니다.

---

### 2. [CURRENT_STATUS.md](./CURRENT_STATUS.md) ⭐
**현재 상태 및 다음 계획**
- 전체 진행 상황 (진행률)
- 완료된 작업 목록
- 다음 단계 우선순위
- 알려진 이슈 및 개선 아이디어

👉 **개발을 시작하기 전에 항상 확인하세요!**

---

## 📂 문서 디렉토리

### 📅 [개발 일지](./logs/)
시간순 개발 활동 기록 (연도/월별 구조)
- [2025년 11월](./logs/2025/11-November.md)

### 🔧 [기술 결정](./decisions/)
주제별 기술적 의사결정
- [아키텍처](./decisions/architecture.md)
- [데이터베이스](./decisions/database.md)
- [프론트엔드](./decisions/frontend.md)
- [인프라/배포](./decisions/infrastructure.md)
- [최적화](./decisions/optimization.md)

---

## 🤖 AI 어시스턴트 가이드

새로운 개발 세션을 시작할 때 **이 순서**로 문서를 읽으세요:

1. **PROJECT_OVERVIEW.md** - 프로젝트 전체 맥락 파악
2. **CURRENT_STATUS.md** - 현재 상태 및 다음 할 일 확인
3. **logs/2025/11-November.md** (최근 항목만) - 최근 작업 내역
4. **decisions/** (필요시) - 기술적 결정 배경 이해

---

## 👤 사용자 가이드

### 처음 프로젝트를 접하는 경우
1. [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) 읽기
2. [메인 README.md](../README.md) 읽기
3. [CURRENT_STATUS.md](./CURRENT_STATUS.md)에서 현재 상태 확인

### 개발을 재개하는 경우
1. [CURRENT_STATUS.md](./CURRENT_STATUS.md)에서 다음 단계 확인
2. 필요시 [logs/](./logs/)에서 최근 기록 확인

### 기술적 질문이 있는 경우
1. [decisions/](./decisions/)에서 관련 주제 문서 찾기
2. 없으면 해당 주제 문서에 새 Q&A 추가

---

## 📝 문서 업데이트 규칙

### 개발 일지 (logs/)
- 주요 작업 완료 시마다 기록
- 월별 파일에 날짜별로 구분하여 작성
- 변경 파일 명시
- 이슈 및 해결 방법 기록

### 기술 결정 (decisions/)
- 중요한 기술적 결정을 내릴 때마다 기록
- 해당 주제의 문서에 Q&A 형식으로 추가
- 결정 이유와 대안 명시
- 날짜 기록

### 현재 상태 (CURRENT_STATUS.md)
- 작업 시작/완료 시마다 체크리스트 업데이트
- 진행률 업데이트
- 다음 단계 우선순위 조정
- 날짜 업데이트

### 프로젝트 개요 (PROJECT_OVERVIEW.md)
- 프로젝트의 근본적인 변경이 있을 때만 수정
- 초기 목표와 방향성 유지

---

## 🔄 문서 버전 관리

모든 문서는 Git으로 버전 관리됩니다.

**권장 커밋 메시지 형식**:
```
docs: [카테고리] 업데이트 내용 요약

- 상세 변경 내역 1
- 상세 변경 내역 2
```

예시:
```
docs: logs 2025년 11월 개발 환경 설정 완료 기록

- Google Maps API 키 발급 완료
- WSL 환경 설정 및 테스트
```

---

## 📊 문서 구조

```
docs/
├── README.md                    # 이 문서
├── PROJECT_OVERVIEW.md          # 프로젝트 개요
├── CURRENT_STATUS.md            # 현재 상태
├── logs/                        # 개발 일지
│   ├── README.md               # 일지 인덱스
│   └── 2025/
│       └── 11-November.md      # 2025년 11월
└── decisions/                   # 기술 결정
    ├── README.md               # 결정 인덱스
    ├── architecture.md         # 아키텍처
    ├── database.md             # 데이터베이스
    ├── frontend.md             # 프론트엔드
    ├── infrastructure.md       # 인프라
    └── optimization.md         # 최적화
```
