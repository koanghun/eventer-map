# Event Extractor Pipeline

AI 기반 이메일 이벤트 데이터 추출 파이프라인 프로젝트입니다. Gmail에서 이메일을 가져와 AI를 통해 이벤트 정보(아티스트, 일시, 장소 등)를 추출하고 정형화된 데이터로 저장합니다.

---

## 🛠️ Git 설정 및 가이드

이 프로젝트는 중요 정보(API 키, 자격 증명 등)를 포함하고 있으므로 Git 사용 시 주의가 필요합니다.

### 1. 기본 설정 (초기화 완료)

현재 프로젝트 디렉토리에서 Git 저장소가 초기화되었습니다.

```bash
git init
```

### 2. 🔒 보안 및 `.gitignore`

보안을 위해 다음 파일들은 절대 Git에 포함되어서는 안 됩니다. 이미 `.gitignore` 파일에 등록되어 있습니다.

| 파일명 | 설명 |
| :--- | :--- |
| `.env` | 환경 변수 (API 키, DB 접속 정보 등) |
| `credentials.json` | Google API 클라이언트 자격 증명 |
| `token.json` | Google API 사용자 인증 토큰 |
| `__pycache__/` | Python 컴파일 캐시 |

> [!WARNING]
> `.env`를 수정하거나 새로운 중요 파일을 생성하는 경우, `.gitignore`에 등록되어 있는지 확인하세요.  
> 만약 실수로 중요 파일이 커밋되었다면, 즉시 히스토리 삭제 또는 키 재발급 등의 조치를 취해야 합니다.

---

### 3. 🔄 기본 워크플로우

#### 변경 사항 추가
```bash
git add <파일명>          # 특정 파일 추가
git add .               # 모든 변경 사항 추가 (강력히 권장)
```

#### 커밋 생성
커밋 메시지는 변경 사항을 명확히 알 수 있도록 작성합니다.
```bash
git commit -m "feat: 이메일 파싱 로직 추가"
```

#### 브랜치 관리
기본(Default) 브랜치는 `master` (또는 `main`)입니다. 새로운 기능을 개발할 때는 브랜치를 생성하는 것을 권장합니다.
```bash
git checkout -b feature/요청사항   # 브랜치 생성 및 이동
```

---

### 4. 🌐 원격 저장소 연결 (GitHub 등)

GitHub 또는 GitLab 등에 원격 저장소를 생성한 후 아래 명령어로 연결할 수 있습니다.

```bash
# 원격 저장소 연결
git remote add origin <사용할_원격_저장소_URL>

# 첫 푸시 (업스트림 설정)
git push -u origin master
```

---

## 📂 프로젝트 구조

- `main.py`: 파이프라인 실행 엔트리포인트
- `config.py`: 설정 관리
- `core/`: 핵심 로직 (LLM 클라이언트 등)
- `services/`: 외부 서비스 연동 (Gmail 등)
- `models/`: 데이터 모델 정의
- `.env.example`: 환경 변수 예시 파일

---

## 🚀 시작하기

1.  의존성 설치
    ```bash
    pip install -r requirements.txt
    ```
2.  `.env` 파일 생성 ( `.env.example` 참고 )
3.  `credentials.json` 파일 배치
4.  실행
    ```bash
    python main.py
    ```
