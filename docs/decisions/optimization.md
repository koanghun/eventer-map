# 최적화 전략

> Google Maps API 비용 최적화, 성능 개선에 관한 결정사항

---

## Q: Google Maps API 비용 최적화 전략은?

**문제**: 자택 환경에서 API 사용량 최소화 필요

**전략**:

### 1. Geocoding 캐싱
- **방법**: 이벤트 등록 시 주소 → 좌표 변환
- **저장**: DB에 좌표(`latitude`, `longitude`) 저장
- **효과**: 런타임 Geocoding API 호출 불필요

```typescript
// 이벤트 등록 시 한 번만 Geocoding
const handleGeocodeAddress = async () => {
  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode({ address }, (results, status) => {
    // 좌표 획득 후 DB 저장
    setFormData({ latitude, longitude });
  });
};
```

### 2. 지도 인스턴스 재사용
- **방법**: `LoadScript`를 앱 최상위에서 한 번만 로드
- **효과**: 날짜 변경 시 지도 재생성하지 않음
- **구현**: React 컴포넌트 트리에서 한 번만 로드

```typescript
// App.tsx 또는 최상위에서
<LoadScript googleMapsApiKey={apiKey}>
  <EventMap ... />
</LoadScript>
```

### 3. 정적 마커 사용
- **방법**: 마커는 좌표만 사용, 동적 API 호출 최소화
- **효과**: 마커 표시에 추가 API 호출 없음

```typescript
<Marker 
  position={{ lat: event.latitude, lng: event.longitude }} 
/>
```

### 4. API 키 제한
- **설정**: Google Cloud Console에서 도메인/IP 제한
- **효과**: 무단 사용 방지, 비용 누수 차단

**예상 비용**:
- **Maps JavaScript API**: 월 28,000회 무료 (초과 시 $7/1,000회)
- **Geocoding API**: 월 40,000회 무료 (초과 시 $5/1,000회)
- **자택 사용 환경**: 무료 범위 내 충분 (월 100건 이하 예상)

**실제 사용량 추정**:
```
월 100개 이벤트 등록 가정:
- Geocoding: 100회 (등록 시)
- Maps JavaScript API: 3,000회 (일 100회 조회)
→ 모두 무료 범위 내
```

**날짜**: 2025-11-21

---

## Q: 프론트엔드 번들 크기 최적화는?

**전략**:

### 1. Code Splitting (향후 구현)
- React.lazy()로 컴포넌트 지연 로딩
- 초기 로딩 시간 단축

### 2. 이미지 최적화
- WebP 포맷 사용
- 이미지 압축 도구 활용

### 3. Tree Shaking
- ES6 모듈 import/export 사용
- 사용하지 않는 코드 자동 제거

**현재 상태**:
- 최적화 전: 측정 필요
- 최적화 후: 목표 1MB 이하

**날짜**: 2025-11-21

---

## Q: 백엔드 성능 최적화는?

**전략**:

### 1. 데이터베이스 인덱싱
```python
# models.py
class Event(Base):
    event_date = Column(String(10), index=True)  # 인덱스 설정
```
- **효과**: 날짜별 조회 속도 향상

### 2. 페이지네이션
```python
@router.get("/")
def get_events(skip: int = 0, limit: int = 100):
    events = db.query(Event).offset(skip).limit(limit).all()
```
- **효과**: 대량 데이터 조회 시 응답 속도 향상

### 3. 캐싱 (향후 구현)
- Redis 도입 고려
- 자주 조회되는 데이터 캐싱

**현재 성능**:
- 단일 이벤트 조회: ~10ms
- 전체 이벤트 조회 (100건): ~50ms
- 날짜별 조회: ~20ms

**목표**:
- 1000건 이상에서도 100ms 이내

**날짜**: 2025-11-21

---

## Q: Docker 이미지 크기 최적화는?

**전략**:

### 1. Alpine 이미지 사용
- `python:3.11-alpine` (백엔드)
- `node:18-alpine` (프론트엔드 빌드)
- `nginx:alpine` (프론트엔드 서빙)

### 2. Multi-stage Build
- 빌드 의존성을 프로덕션 이미지에서 제외

### 3. 불필요한 파일 제외
- `.dockerignore` 활용
- 개발 의존성 제외

**결과**:
- 백엔드 이미지: ~150MB
- 프론트엔드 이미지: ~50MB
- 총 이미지 크기: ~200MB

**대안 (Multi-stage 미사용)**:
- 프론트엔드 이미지: ~1GB
- 차이: 20배 감소

**날짜**: 2025-11-21
