"""
이벤트 중복 검사 유틸리티

이 모듈은 이벤트 중복 여부를 판단하기 위한 다양한 유사도 계산 함수를 제공합니다.
"""

from datetime import datetime
from difflib import SequenceMatcher
from typing import Dict, List, Optional
from geopy.distance import geodesic
from sqlalchemy.orm import Session
import models


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    두 좌표 간의 거리를 미터 단위로 계산 (Haversine 공식)
    
    Args:
        lat1, lon1: 첫 번째 지점의 위도, 경도
        lat2, lon2: 두 번째 지점의 위도, 경도
        
    Returns:
        float: 두 지점 간 거리 (미터)
    """
    if not all([lat1, lon1, lat2, lon2]):
        return float('inf')
    
    try:
        distance = geodesic((lat1, lon1), (lat2, lon2)).meters
        return distance
    except Exception:
        return float('inf')


def calculate_time_difference(time1: Optional[str], time2: Optional[str]) -> int:
    """
    두 시간의 차이를 분 단위로 계산
    
    Args:
        time1, time2: "HH:MM" 형식의 시간 문자열
        
    Returns:
        int: 시간 차이 (분)
    """
    if not time1 or not time2:
        return 999  # 시간 정보 없으면 큰 값 반환
    
    try:
        t1 = datetime.strptime(time1, "%H:%M")
        t2 = datetime.strptime(time2, "%H:%M")
        diff = abs((t2 - t1).total_seconds() / 60)
        return int(diff)
    except ValueError:
        return 999


def calculate_text_similarity(text1: Optional[str], text2: Optional[str]) -> float:
    """
    두 텍스트의 유사도를 계산 (0.0 ~ 1.0)
    
    Args:
        text1, text2: 비교할 텍스트
        
    Returns:
        float: 유사도 점수 (0.0 = 완전히 다름, 1.0 = 완전 일치)
    """
    if not text1 or not text2:
        return 0.0
    
    # 정규화 (소문자, 공백 제거)
    t1 = text1.lower().strip()
    t2 = text2.lower().strip()
    
    return SequenceMatcher(None, t1, t2).ratio()


def calculate_performer_similarity(event1: models.Event, event2: models.Event) -> float:
    """
    출연자 리스트 간 유사도 계산 (Jaccard 유사도)
    
    Args:
        event1, event2: 비교할 이벤트 객체
        
    Returns:
        float: 출연자 유사도 (0.0 ~ 1.0)
    """
    # 출연자 이름 세트 (정규화된 이름 사용)
    performers1 = set(p.normalized_name for p in event1.performers_rel)
    performers2 = set(p.normalized_name for p in event2.performers_rel)
    
    if not performers1 or not performers2:
        return 0.0
    
    # Jaccard 유사도 (교집합 / 합집합)
    intersection = len(performers1 & performers2)
    union = len(performers1 | performers2)
    
    return intersection / union if union > 0 else 0.0


def calculate_event_similarity(event1: models.Event, event2: models.Event) -> Dict:
    """
    이벤트 간 종합 유사도 계산
    
    가중치:
    - 날짜: 25%
    - 거리: 20%
    - 시간: 15%
    - 출연자: 25%
    - 제목: 15%
    
    Args:
        event1, event2: 비교할 이벤트 객체
        
    Returns:
        dict: 유사도 정보
            - is_duplicate: 중복 여부 (bool)
            - similarity_score: 종합 유사도 (0.0 ~ 1.0)
            - matched_criteria: 각 기준별 상세 정보 (dict)
            - recommendation: "duplicate" | "similar" | "maybe" | "different"
    """
    # 1. 날짜 일치 (25%)
    same_date = event1.event_date == event2.event_date
    date_score = 1.0 if same_date else 0.0
    
    # 2. 거리 (20%)
    distance = calculate_distance(
        event1.latitude, event1.longitude,
        event2.latitude, event2.longitude
    )
    # 0m = 1.0, 50m = 0.5, 100m+ = 0.0
    location_score = max(0, 1 - (distance / 100)) if distance <= 100 else 0.0
    
    # 3. 시간 겹침 (15%)
    time_diff = calculate_time_difference(event1.start_time, event2.start_time)
    # 0분 = 1.0, 30분 = 0.5, 60분+ = 0.0
    time_score = max(0, 1 - (abs(time_diff) / 60)) if abs(time_diff) <= 60 else 0.0
    
    # 4. 출연자 유사도 (25%)
    performer_score = calculate_performer_similarity(event1, event2)
    
    # 5. 제목 유사도 (15%)
    title_score = calculate_text_similarity(event1.title, event2.title)
    
    # 가중 합계
    total_score = (
        date_score * 0.25 +
        location_score * 0.20 +
        time_score * 0.15 +
        performer_score * 0.25 +
        title_score * 0.15
    )
    
    # 중복 판정 (엄격한 기준)
    is_duplicate = (
        same_date and 
        distance <= 50 and 
        abs(time_diff) <= 30 and
        (performer_score >= 0.8 or title_score >= 0.8)
    )
    
    # 추천 분류
    if is_duplicate:
        recommendation = "duplicate"      # 중복 가능성 매우 높음
    elif total_score >= 0.7:
        recommendation = "similar"        # 유사함, 주의 필요
    elif total_score >= 0.4:
        recommendation = "maybe"          # 애매함, 사용자 확인
    else:
        recommendation = "different"      # 다른 이벤트
    
    return {
        "is_duplicate": is_duplicate,
        "similarity_score": round(total_score, 2),
        "matched_criteria": {
            "same_date": same_date,
            "same_location": distance <= 50,
            "same_time": abs(time_diff) <= 30,
            "distance_meters": round(distance, 1) if distance != float('inf') else None,
            "time_diff_minutes": time_diff if time_diff != 999 else None,
            "performer_similarity": round(performer_score, 2),
            "title_similarity": round(title_score, 2)
        },
        "recommendation": recommendation
    }


def find_duplicate_events(
    db: Session,
    event_date: str,
    latitude: float,
    longitude: float,
    start_time: Optional[str] = None,
    exclude_id: Optional[int] = None
) -> List[Dict]:
    """
    중복 가능성이 있는 이벤트 목록 조회
    
    Args:
        db: 데이터베이스 세션
        event_date: 이벤트 날짜 (YYYY-MM-DD)
        latitude, longitude: 이벤트 위치 좌표
        start_time: 개연 시간 (HH:MM)
        exclude_id: 제외할 이벤트 ID (수정 시 자기 자신 제외)
        
    Returns:
        list: 중복 가능성 있는 이벤트 목록 (유사도 높은 순)
    """
    # 같은 날짜의 이벤트만 조회
    query = db.query(models.Event).filter(models.Event.event_date == event_date)
    
    if exclude_id:
        query = query.filter(models.Event.id != exclude_id)
    
    existing_events = query.all()
    
    if not existing_events:
        return []
    
    # 임시 이벤트 객체 생성
    temp_event = models.Event(
        event_date=event_date,
        latitude=latitude,
        longitude=longitude,
        start_time=start_time,
        title="",  # 타이틀은 API에서 별도로 전달
        performers_rel=[]  # 출연자도 별도 처리
    )
    
    # 각 이벤트와의 유사도 계산
    duplicates = []
    for existing in existing_events:
        similarity = calculate_event_similarity(temp_event, existing)
        
        # 유사도가 일정 이상인 경우만 포함
        if similarity["similarity_score"] >= 0.4:
            duplicates.append({
                "event_id": existing.id,
                "event_title": existing.title,
                "event_date": existing.event_date,
                "location": existing.location,
                "start_time": existing.start_time,
                **similarity
            })
    
    # 유사도 높은 순으로 정렬
    duplicates.sort(key=lambda x: x["similarity_score"], reverse=True)
    
    return duplicates
