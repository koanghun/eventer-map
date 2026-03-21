# AI 기반 이벤트 데이터 추출 파이프라인 완료 보고서 (Phase 2)

기존 파이프라인에 **중복 수신 방지(라벨링)** 및 **데이터 모델 고도화**를 적용한 Phase 2 구현을 완료했습니다.

---

## 📂 업데이트된 프로젝트 구조

```text
~/projects/event-extractor/
├── services/
│   └── gmail_service.py    # [수정] modify 권한 확장, 라벨(Event-Processed) 관리 로직 추가
├── models/
│   └── event.py            # [수정] title, performers[], door_time, start_time 필드 확장
├── core/
│   └── llm_client.py       # [수정] 확장된 필드를 추출하기 위한 시스템 프롬프트 고도화
└── main.py                 # [수정] 성공 시 라벨 부착 로직 연동
```

---

## 🛠️ Phase 2 핵심 구현 내용

1. **Gmail Custom Label 기반 중복 수신 최적화**
   - 분석이 성공적으로 끝나면 메일에 `Event-Processed` 라벨을 부착합니다.
   - 검색 쿼리 끝에 `-label:Event-Processed`가 자동 추가되어 **이미 처리된 메일은 조회 대상에서 원천 배제**됩니다.

2. **데이터 모델 및 프롬프트 고도화**
   - 백엔드 DB 스키마에 즉시 매핑 가능하도록 추출 필드를 확장했습니다.
   - **추출 필드**: `title`(공연명), `performers`(다중 출연진 목록), `event_date`, `door_time`, `start_time`, `location`

---

## ✅ 검증 결과 (Verification)

### 1. 라벨링 및 중복 수신 배제 테스트
*   **1차 실행**: AI가 메일 내용(ID: `16d7631156a5f3f7` 등)에서 이벤트를 추출한 뒤, `Event-Processed` 라벨 부착 완료를 로깅했습니다.
*   **2차 실행**: 동일 쿼리로 다시 조회 시, **이미 라벨이 달린 메일은 검색 결과에서 제외**되어 중복 처리가 방지됨을 검증했습니다.

### 2. 고도화된 AI 추출 결과 양식
```json
[
  {
    "title": "愛美とはるかの２年Ａ組青春アクティ部＆Ｐｙｘｉｓのキラキラ大作戦！　合同イベント",
    "performers": [
      "愛美とはるかの２年Ａ組青春アクティ部",
      "Ｐｙｘｉｓ"
    ],
    "event_date": "2019-11-24",
    "door_time": null,
    "start_time": "14:30",
    "location": "ヒューリックホール東京(東京都)"
  }
]
```

이제 안정적으로 새로운 메일만 가져와 백엔드 규격에 맞는 고도화된 데이터를 추출할 수 있습니다.
