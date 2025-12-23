"""
이벤트 히스토리 생성 및 관리 유틸리티
"""

import json
from sqlalchemy.orm import Session
from typing import Dict, Any
import models


def create_event_history(
    db: Session, 
    event: models.Event, 
    user: models.User, 
    action: str
) -> models.EventHistory:
    """
    이벤트 히스토리 생성
    
    Args:
        db: 데이터베이스 세션
        event: 이벤트 객체
        user: 작업을 수행한 사용자
        action: 'created', 'updated', 'deleted'
    
    Returns:
        생성된 EventHistory 객체
    """
    # 스냅샷 생성 (현재 이벤트 데이터)
    snapshot = {
        "title": event.title,
        "description": event.description,
        "event_date": event.event_date,
        "location": event.location,
        "address": event.address,
        "latitude": event.latitude,
        "longitude": event.longitude,
        "door_time": event.door_time,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "performers": event.performers,
        "related_link": event.related_link
    }
    
    # 변경 사항 요약 (주요 필드만)
    changes_summary = f"{action}: {event.title} @ {event.location}"
    
    history = models.EventHistory(
        event_id=event.id,
        user_id=user.id,
        action=action,
        snapshot=json.dumps(snapshot, ensure_ascii=False),
        changes_summary=changes_summary
    )
    
    db.add(history)
    db.flush()
    return history


def get_event_history_with_user_info(
    db: Session,
    event_id: int
) -> list:
    """
    이벤트 히스토리를 사용자 정보와 함께 조회
    
    Args:
        db: 데이터베이스 세션
        event_id: 이벤트 ID
    
    Returns:
        히스토리 목록 (사용자 정보 포함)
    """
    histories = db.query(models.EventHistory, models.User).join(
        models.User, models.EventHistory.user_id == models.User.id
    ).filter(
        models.EventHistory.event_id == event_id
    ).order_by(
        models.EventHistory.created_at.desc()
    ).all()
    
    result = []
    for history, user in histories:
        result.append({
            "id": history.id,
            "event_id": history.event_id,
            "user_id": history.user_id,
            "user_name": user.name,
            "user_email": user.email,
            "action": history.action,
            "snapshot": json.loads(history.snapshot),
            "changes_summary": history.changes_summary,
            "created_at": history.created_at
        })
    
    return result
