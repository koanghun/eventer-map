"""
이벤트 중복 검사 유틸리티

이 모듈은 이벤트 중복 여부를 판단하기 위한 다양한 유사도 계산 함수를 제공합니다.
"""

from datetime import datetime
from difflib import SequenceMatcher
from typing import Dict, List, Optional
from geopy.distance import geodesic
from sqlalchemy.orm import Session
import models, schemas


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
    
    distance = geodesic((lat1, lon1), (lat2, lon2)).meters
    return distance


def calculate_time_difference(time1: Optional[str], time2: Optional[str]) -> Optional[int]:
    """
    두 시간의 차이를 분 단위로 계산
    
    Args:
        time1, time2: "HH:MM" 형식의 시간 문자열
        
    Returns:
        int: 시간 차이 (분)
    """
    if not time1 or not time2:
        return None  # 시간 정보 없으면 None
    
    t1 = datetime.strptime(time1, "%H:%M")
    t2 = datetime.strptime(time2, "%H:%M")
    diff = abs((t2 - t1).total_seconds() / 60)
    return diff


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
    if distance == float('inf'):
        location_score = 0.0
    else:
        location_score = max(0, 1 - (distance / 100)) if distance <= 100 else 0.0

    # 4. 출연자 유사도 (25%)
    performer_score = calculate_performer_similarity(event1, event2)
    
    # 5. 제목 유사도 (15%)
    title_score = calculate_text_similarity(event1.title, event2.title)

    # 시간 제외 기본 점수 및 가중치
    base_score = (
        date_score * 0.25 +
        location_score * 0.20 +
        performer_score * 0.25 +
        title_score * 0.15
    )
    base_weight = 0.85 # 1.0 - 0.15 (시간 가중치)

    # 3. 시간 겹침 (15%) - 각 시간을 독립적으로 비교
    time_score_raw = 0.0
    time_comparisons = 0
    
    # door_time 비교
    door_diff = None
    if event1.door_time and event2.door_time:
        door_diff = calculate_time_difference(event1.door_time, event2.door_time)
        if door_diff is not None and door_diff <= 30:
            time_score_raw += 1.0
        time_comparisons += 1
    
    # start_time 비교
    start_diff = None
    if event1.start_time and event2.start_time:
        start_diff = calculate_time_difference(event1.start_time, event2.start_time)
        if start_diff is not None and start_diff <= 30:
            time_score_raw += 1.0
        time_comparisons += 1
    
    # end_time 비교
    end_diff = None
    if event1.end_time and event2.end_time:
        end_diff = calculate_time_difference(event1.end_time, event2.end_time)
        if end_diff is not None and end_diff <= 30:
            time_score_raw += 1.0
        time_comparisons += 1
    
    # 평균 점수 계산 (비교한 시간이 있을 경우에만)
    time_weighted_score = 0.0
    if time_comparisons > 0:
        time_weighted_score = (time_score_raw / time_comparisons) * 0.15
        final_score = base_score + time_weighted_score
    else:
        # 시간 정보가 없으면, 다른 항목들의 점수를 1.0 만점으로 환산
        final_score = base_score / base_weight if base_weight > 0 else 0.0

    # 중복 판정 (엄격한 기준)
    # 필수: 날짜 일치
    # 위치: 좌표가 있을 때만 거리 체크 (없으면 통과)
    # 시간: 시간 정보가 있을 때만 시간 체크 (없으면 통과)
    # 출연자/제목: 둘 중 하나는 높은 유사도여야 함
    
    # 시간 일치 판정: 비교한 시간 중 하나라도 30분 이내면 일치로 간주
    time_match = False
    if time_comparisons > 0:
        # 비교한 시간들 중에서 일치하는 게 있는지 확인
        time_match = (
            (door_diff is not None and door_diff <= 30) or
            (start_diff is not None and start_diff <= 30) or
            (end_diff is not None and end_diff <= 30)
        )
    else:
        # 시간 정보가 없으면 통과
        time_match = True
    
    is_duplicate = (
        same_date and 
        (distance != float('inf') and distance <= 50) and 
        time_match and
        (performer_score >= 0.8 or title_score >= 0.8)
    )
    
    # 추천 분류
    if is_duplicate:
        recommendation = "duplicate"      # 중복 가능성 매우 높음
    elif final_score >= 0.7:
        recommendation = "similar"        # 유사함, 주의 필요
    elif final_score >= 0.4:
        recommendation = "maybe"          # 애매함, 사용자 확인
    else:
        recommendation = "different"      # 다른 이벤트
    
    return {
        "is_duplicate": is_duplicate,
        "similarity_score": round(final_score, 2),
        "matched_criteria": {
            "same_date": same_date,
            "same_location": distance != float('inf') and distance <= 50,
            "same_time": time_match,
            "distance_meters": round(distance, 1) if distance != float('inf') else None,
            "door_time_diff_minutes": door_diff,
            "start_time_diff_minutes": start_diff,
            "end_time_diff_minutes": end_diff,
            "performer_similarity": round(performer_score, 2),
            "title_similarity": round(title_score, 2)
        },
        "recommendation": recommendation
    }


def find_duplicate_events(
    db: Session,
    event_data: models.Event,
    exclude_id: Optional[int] = None
) -> List[Dict]:
    """
    중복 가능성이 있는 이벤트 목록 조회
    
    Args:
        db: 데이터베이스 세션
        event_data: 중복 검사할 이벤트 데이터
        exclude_id: 제외할 이벤트 ID (수정 시 자기 자신 제외)
        
    Returns:
        list: 중복 가능성 있는 이벤트 목록 (유사도 높은 순)
    """
    # 같은 날짜의 이벤트만 조회
    query = db.query(models.Event).filter(models.Event.event_date == event_data.event_date)
    
    if exclude_id:
        query = query.filter(models.Event.id != exclude_id)
    
    existing_events = query.all()
    
    if not existing_events:
        return []
    
    # 각 이벤트와의 유사도 계산
    duplicates = []
    for existing in existing_events:
        similarity = calculate_event_similarity(event_data, existing)
        
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


def is_duplicate(
    event_data: models.Event,
    db: Session,
    threshold: float = 0.85
) -> str:
    """
    입력된 이벤트 데이터가 기존 DB의 이벤트와 중복되는지 확인
    
    Args:
        event_data: 확인할 이벤트 데이터 (models.Event)
        db: DB 세션
        threshold: 중복으로 판단할 유사도 점수 임계값
        
    Returns:
        "definite": 확실한 중복
        "high": 중복 가능성 높음
        "low": 중복 가능성 낮음
    """
    duplicates = find_duplicate_events(db, event_data)
    
    if not duplicates:
        return "low"
    
    # 가장 유사도가 높은 이벤트
    most_similar_event_info = duplicates[0]
    
    # calculate_event_similarity에서 반환된 is_duplicate 플래그와 similarity_score 사용
    is_definite_duplicate = most_similar_event_info["is_duplicate"]
    similarity_score = most_similar_event_info["similarity_score"]

    if is_definite_duplicate:
        return "definite"
    elif similarity_score >= threshold: # threshold를 활용하여 "high"를 판단
        return "high"
    return "low"
