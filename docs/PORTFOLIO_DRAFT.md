# [Portfolio] Eventer Map: 지능형 공연/이벤트 정보 통합 서비스

---

## 1. 프로젝트 개요 (Overview)

### **"모든 공연과 이벤트, 이제 지도로 한눈에 확인하세요."**

**Eventer Map**은 흩어져 있는 공연 및 이벤트 정보를 지도를 중심으로 시각화하여, 사용자가 원하는 시간과 장소의 이벤트를 직관적으로 탐색하고 관리할 수 있도록 돕는 웹 애플리케이션입니다.

- **개발 기간**: 2025.11 ~ 2026.03 (지속적 고도화 중)
- **주요 역할**: 프로젝트 기획, 시스템 설계, 풀스택 개발 및 인프라 구축
- **핵심 가치**: 데이터 정규화를 통한 정확한 정보 제공, 위치 기반 직관적 UX, 저비용·고효율의 안정적인 셀프 호스팅 인프라

---

## 2. 주요 기능 및 예시 (Key Features & Examples)

### 🗺️ 구글 맵 기반 인터랙티브 탐색
- 실시간 위치 기반 이벤트 마커 표시 및 상세 정보(InfoWindow) 제공
- **[예시]**: "2026-03-31" 날짜 필터 선택 시, 해당 날짜에 열리는 도쿄돔과 시부야 인근의 모든 공연 정보가 지도상에 즉시 동기화되어 표시됩니다.

### 🏷️ 지능형 데이터 정규화 및 관리
- **출연자/장소 자동 정규화**: 다양한 표기법을 하나의 표준 명칭으로 통합 관리하여 데이터 무결성 확보
- **사용자 입력 예시**: 
  - `아이브`, `IVE`, `ive`, `ヨアソビ` -> 시스템 내부적으로 **`ive`**, **`yoasobi`**와 같은 단일 고유값으로 자동 매칭 및 저장
- **별칭(Aliases) 시스템**: "도쿄돔" 검색 시 "Tokyo Dome", "東京ドーム" 등 다국어 별칭 기반 검색 지원

- **하이브리드 인프라 활용**: 고성능 추론이 필요한 **Event Extractor**와 **SGLang**은 데스크탑(GPU/WSL2) 환경에서, 웹 서비스와 DB는 **Synology NAS**에서 구동하는 효율적인 분산 아키텍처 구축

### 🔒 사용자 인증 및 참여 시스템
- **Google OAuth 2.0**: 소셜 로그인을 통한 간편하고 안전한 인증 체계
- **개인화 예시**: 사용자가 특정 아티스트의 공연에 '참여 예정(Join)' 버튼을 클릭하면, 해당 이벤트는 사용자의 개인 대시보드에 즉시 반영되며 지도 필터링 시 우선순위로 노출됩니다.

### 📊 안정적인 데이터 이력 관리
- 모든 이벤트 생성/수정/삭제 활동을 히스토리로 기록하여 데이터 변경 추적 가능(Audit logging)
- **[예시]**: 특정 이벤트의 신고가 5회 이상 누적될 경우, 관리자가 개입하지 않아도 시스템이 자동으로 해당 이벤트를 `is_hidden=True` 처리하여 커뮤니티 정화 기능을 수행합니다.

---

## 3. 기술 스택 (Tech Stack)

### **Frontend**
- **Core**: React, TypeScript, TanStack Query (React Query)
- **Styling**: Tailwind CSS, shadcn/ui

### **Backend**
- **Framework**: FastAPI (Python 3.11/3.12), SQLAlchemy 2.0, Alembic
- **AI & Pipeline**: SGLang, Qwen2.5-7B-Instruct (GPTQ-Int4), Gmail API

### **Infrastructure & DevOps**
- **Hardware (Desktop)**: NVIDIA RTX 3060 (12GB VRAM)
- **Hardware (Server)**: Synology NAS (Self-hosting, INTEL Celeron J4125, 20GB RAM)
- **Environment**: Docker, NVIDIA Container Toolkit (WSL2), Nginx, PostgreSQL

---

## 4. 핵심 기술적 도전 및 해결 (Technical Achievements)

### 🚀 고정밀 중복 방지 시스템 구축
- **문제**: 사용자들이 동일한 이벤트를 중복으로 등록하거나, 유사한 명칭으로 데이터를 파편화시키는 문제 발생
- **해결**: **Jaccard 유사도 알고리즘**과 **Geodesic Distance(지리적 거리)**를 결합한 하이브리드 중복 검사 로직 구현
- **핵심 알고리즘 코드 (Jaccard Similarity)**:
  ```python
  def calculate_performer_similarity(event1, event2):
      """출연자 리스트 간 교집합/합집합 비율을 통한 유사도 측정"""
      p1 = set(p.normalized_name for p in event1.performers)
      p2 = set(p.normalized_name for p in event2.performers)
      
      if not p1 or not p2: return 0.0
      
      intersection = len(p1 & p2)
      union = len(p1 | p2)
      
      return intersection / union if union > 0 else 0.0
  ```
- **성과**: 날짜(25%), 거리(20%), 출연자(25%), 제목(15%) 등에 가중치를 부여한 종합 점수 산출로 데이터 무결성을 90% 이상 향상시켰습니다.

### 🤖 하이브리드 AI 인프라 구축 (NAS + Desktop GPU)
- **문제**: 고성능 LLM(Qwen2.5-7B) 추론을 위해 GPU 가속이 필수적이지만, 저전력 기반의 Synology NAS 단독으로는 성능 한계가 존재
- **해결**: 데스크탑(Windows 11 + WSL2)의 RTX 3060 자원을 활용하여 **SGLang** 서버와 **Event Extractor**를 별도로 구동하고, 결과 데이터만 NAS의 DB에 연동하는 하이브리드 구조 설계
- **성과**: 외부 API 대비 **비용 100% 절감**, 데이터 입력 공수 80% 이상 단축 및 대량의 과거 이메일 데이터 소급 적용 가능
- **핵심 프롬프트 설계 (Prompt Engineering)**:
  ```python
  # 비정형 데이터 정제 및 JSON 추출을 위한 시스템 프롬프트 예시
  _SYSTEM_PROMPT = """
  1. Extract: 
     - title: STRICT: Exclude ticket sales types (e.g., "先行", "一般発売").
     - performers: list of artists. STRICT: Exclude roles (e.g., "東山奈央(志摩リン役)").
     - location: Name of the venue ONLY. Do NOT include region (e.g., "(東京都)").
  2. Always respond with ONLY valid JSON format.
  """
  ```

### 🌐 저비용·고효율의 안정적 인프라 운영
- **문제**: 유동 IP 환경에서 외부 접속 안정성을 확보하고, Google Maps API 호출 비용을 관리해야 하는 과제
- **해결**: MyDNS와 Synology Reverse Proxy를 연동하고, Geocoding 결과를 DB에 캐싱하는 구조 설계
### **시스템 아키텍처 (Infrastructure)**
  ```mermaid
  graph TD
      User["🌍 사용자 (Browser)"] -- HTTPS/443 --> MyDNS["🌐 MyDNS (DDNS)"]
      MyDNS -- Forward --> NAS_Host["📦 Synology NAS"]
      
      subgraph NAS_Node ["📦 Synology NAS (Web Node)"]
          Proxy["🛡️ 리버스 프록시"]
          Nginx["🌐 Nginx (Frontend)"]
          App["⚙️ FastAPI Backend"]
          DB["🐘 PostgreSQL"]
      end
      
      subgraph Desktop_Node ["💻 Desktop (AI Node)"]
          Extractor["🤖 Event Extractor (WSL2)"]
          SGLang["🧠 SGLang (Docker)"]
          GPU["🎮 NVIDIA RTX 3060 (WSL)"]
      end

      subgraph External ["외부 연동"]
          Gmail["📩 Gmail API"]
      end
      
      NAS_Host --> Proxy
      Proxy --> Nginx
      Nginx --> App
      App --> DB
      
      Extractor -- "Fetch Email" --> Gmail
      Extractor -- "Inference" --> SGLang
      SGLang -- "Qwen" --> GPU
      Extractor -- "Sync Data" --> App
  ```

---

## 5. Technical Deep Dive: GPU 가속 기반 AI 인프라

### **NVIDIA Container Toolkit (GPU Passthrough)**
- **역할**: Docker 컨테이너가 호스트의 하드웨어 GPU에 직접 접근할 수 있도록 징검다리 역할을 수행합니다.
- **의의**: 복잡한 드라이버 설정 없이도 컨테이너 환경에서 **SGLang**과 같은 AI 추론 엔진이 GPU의 병렬 연산 능력을 100% 활용할 수 있게 합니다.

### **RTX 3060 (WSL2) 하이브리드 환경**
- **기술적 조화**: Windows의 편리한 사용성과 Linux의 강력한 개발 생태계(WSL2)를 결합한 분산 환경입니다.
- **효율성**: Linux 커널에서 직접 GPU 자원을 파스스루(Passthrough)하여, AI 라이브러리가 최적화된 리눅스 환경에서 최상의 성능으로 추론을 수행하도록 설계했습니다.

### **Qwen (Qwen2.5-7B) 모델 선정 이유**
- **언어 이해도**: 한국어와 일본어 등 아시아권 언어에 대한 이해도가 매우 높아, 다국어 공연 메일의 정밀한 분석에 최적화되어 있습니다.
- **성능 대 효율**: RTX 3060(12GB VRAM) 한 장으로도 원활하게 구동 가능한 7B 사이즈이면서도, 상용 모델에 육박하는 뛰어난 지침 준수(Instruction Following) 능력을 갖추고 있습니다.

---

## 6. 프로젝트 성과 및 인사이트

1. **데이터 무결성의 체계적 확보**: 단순 개발을 넘어, 실제 운영 시 발생하는 데이터 파편화 문제를 알고리즘으로 해결하며 백엔드 설계 능력을 증명함
2. **풀스택 관점의 문제 해결**: 프론트엔드의 직관성부터 인프라의 가용성 설정까지 전체 파이프라인을 직접 구축하며 종합적인 엔지니어링 역량을 보유함

---

**ⓒ 2026 Eventer Map. Developed by [User Name]**
