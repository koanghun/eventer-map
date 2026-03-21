# AI 기반 이벤트 데이터 추출 파이프라인 완료 보고서

기존 테스트 스크립트를 통합하여 **메일 수신 → AI 분석 → 구조화된 JSON 반환**으로 이어지는 견고한 파이프라인 구축을 완료했습니다.

---

## 📂 프로젝트 구조

```text
~/projects/event-extractor/
├── .env                    # 설정 (LLM URL, 모델명 등)
├── config.py               # 설정 로드 모듈 (Settings dataclass)
├── fromAndKeyword.json     # 필터 규칙 (from_address + keywords)
├── credentials.json        # Gmail API 인증 파일
├── token.json              # Gmail API 토큰 파일
├── main.py                 # 전체 파이프라인 제어 (CLI 지원)
├── requirements.txt        # 의존성 목록
├── core/
│   └── llm_client.py       # SGLang 서버 통신 & 이벤트 추출
├── models/
│   ├── event.py            # EventData, ExtractionResult Pydantic 스키마
│   └── filter_config.py    # FilterConfig Pydantic 스키마
└── services/
    └── gmail_service.py    # Gmail API 래퍼
```

---

## 🛠️ 핵심 구현 내용

1. **명확한 타입 정의 (Pydantic & Dataclass)**
   - [EventData](file:///home/zse63/projects/event-extractor/models/event.py#11-23): `artist`, `date`, `location`을 명확한 문자열 타입으로 정의.
   - [Settings](file:///home/zse63/projects/event-extractor/config.py#15-38): 복잡한 경로 및 환경 변수 관리를 불변 객체로 캡슐화.

2. **유연한 Gmail 쿼리 빌더**
   - [fromAndKeyword.json](file:///home/zse63/projects/event-extractor/fromAndKeyword.json)의 여러 필터 규칙을 Gmail 복합 검색 쿼리(`OR`, [()](file:///home/zse63/projects/event-extractor/main.py#53-138) 연산자 활용)로 자동 변환하여 효율적으로 메일을 필터링합니다.

3. **안정적인 LLM 클라이언트**
   - SGLang 서버의 Chat Completions API 및 **JSON 모드** 사용.
   - 응답이 비정상적이거나 구조가 깨질 경우 적절한 예외 처리 및 로깅.

---

## ✅ 검증 결과 (Verification)

### 1. 드라이런 (`--dry-run`)
Gmail에서 필터 조건에 매칭되는 메일을 정상적으로 가져옴을 확인했습니다.

### 2. 전체 파이프라인 연동 결과
실제 메일을 대상으로 분석을 수행한 결과, AI가 본문에서 **아티스트, 날짜, 장소**를 정확히 추출했습니다.

**추출 로그 예시:**
```text
[INFO] __main__:    [2/3] 메일 분석 중...
[INFO] core.llm_client: LLM 서버에 추출 요청 전송 중... (http://localhost:30000/v1/chat/completions)
[INFO] __main__:    ✨ 愛美とはるかの２年Ａ組青春アクティ部＆Ｐｙｘｉｓ | 2019-11-24 | ヒューリックホール東京
```

**JSON 출력 결과:**
```json
[
  {
    "artist": "愛美とはるかの２年Ａ組青春アクティ部＆Ｐｙｘｉｓ",
    "date": "2019-11-24",
    "location": "ヒューリックホール東京"
  }
]
```

---

## 🚀 다음 단계 (Next Steps)

- **데이터베이스 저장**: 파이프라인 완성본에서 요약 출력하는 부분을 PostgreSQL 연동 및 저장 로직으로 확장.
- **주기적 실행 (Cron)**: 일정 주기마다 새로운 메일만 가져와 파이프라인을 구동하는 스케줄러 추가.
