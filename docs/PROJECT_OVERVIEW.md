# Event Map 프로젝트 개요

> 📌 **프로젝트 시작일**: 2025-11-21  
> 📌 **주요 목적**: 이벤트 정보를 지도상에 표시하는 웹 애플리케이션

## 🎯 프로젝트 목표

사용자들이 이벤트 정보(개최일, 시간, 개최장소, 출연자, 관련링크 등)를 등록하고, Google Maps API를 사용한 화면에서 날짜를 선택하면 해당 날짜에 등록된 이벤트들이 지도상에 표시되는 애플리케이션 개발

## 🏗️ 기술 스택

### 인프라
- **하드웨어**: Synology NAS
- **컨테이너**: Docker & Docker Compose
- **OS**: Python 3.11-slim (백엔드), Node 18-alpine (프론트엔드 빌드), Nginx-alpine (서빙)

### 백엔드
- **프레임워크**: FastAPI
- **서버**: Uvicorn
- **ORM**: SQLAlchemy
- **데이터베이스**: SQLite (PostgreSQL로 전환 가능)

### 프론트엔드
- **언어**: TypeScript
- **프레임워크**: React 18
- **지도 API**: Google Maps JavaScript API
- **HTTP 클라이언트**: Axios
- **날짜 처리**: date-fns

### 개발 환경
- **WSL 환경**에서 로컬 개발
- **배포 환경**: Synology NAS + Docker

## 💡 핵심 기능

1. **이벤트 관리 (CRUD)**
   - 이벤트 등록 (제목, 설명, 날짜, 시간, 장소, 좌표, 출연자, 링크)
   - 이벤트 수정 및 삭제
   - 이벤트 조회

2. **날짜 기반 필터링**
   - 특정 날짜 선택 시 해당 날짜의 이벤트만 표시
   - 날짜별 이벤트 목록 조회

3. **지도 시각화**
   - Google Maps에 이벤트 마커 표시
   - 마커 클릭 시 이벤트 상세 정보 팝업
   - 이벤트 위치 중심으로 지도 자동 조정

4. **주소 변환 (Geocoding)**
   - 주소 입력 시 자동으로 좌표 변환
   - DB에 좌표 저장하여 런타임 API 호출 최소화

## 🎨 UI/UX 특징

- 모던한 그라데이션 디자인 (보라색 계열)
- Glassmorphism 효과
- 반응형 레이아웃 (모바일/태블릿/데스크톱)
- 부드러운 애니메이션 및 트랜지션
- 직관적인 이벤트 등록 모달

## ⚡ Google Maps API 최적화

**자택 환경에서 API 비용 최소화 전략**:
1. Geocoding을 이벤트 등록 시 한 번만 수행하여 DB에 저장
2. 지도 인스턴스 재사용
3. 정적 마커 사용으로 런타임 API 호출 최소화
4. API 키에 도메인/IP 제한 설정

## 📁 프로젝트 구조

```
eventer-map/
├── backend/          # FastAPI 백엔드
├── frontend/         # React 프론트엔드
├── docs/            # 프로젝트 문서
├── docker-compose.yml
└── README.md
```

## 🔗 관련 문서

- [개발 일지](./logs/) - 날짜별 개발 진행 내역
- [기술 결정](./decisions/) - 중요한 기술적 결정 사항
- [현재 상태](./CURRENT_STATUS.md) - 현재 개발 상태 및 다음 계획

## 📝 참고사항

- 개발은 WSL 환경에서 진행
- 최종 배포는 Synology NAS Docker 환경
- Google Maps API 키 필요 (Maps JavaScript API, Geocoding API)
