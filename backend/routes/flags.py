from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from db import get_db
from db import models
from db import schemas
from utils.auth import require_auth
import json

router = APIRouter(prefix="/flags", tags=["flags"])


@router.post("/events/{event_id}")
async def add_flag_event(
    event_id: int,
    current_user: models.User = require_auth,
    db: Session = Depends(get_db)
) -> schemas.FlagActionResponse:
    """이벤트 플래그 추가"""
    # 이벤트 존재 확인
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # 현재 플래그 목록 가져오기
    flagged_ids = json.loads(current_user.flagged_event_ids or "[]")
    
    # 이미 추가된 경우 스킵
    if event_id in flagged_ids:
        return schemas.FlagActionResponse(message="Already flagged", flagged_event_ids=flagged_ids)
    
    # 추가
    flagged_ids.append(event_id)
    current_user.flagged_event_ids = json.dumps(flagged_ids)
    db.commit()
    
    return schemas.FlagActionResponse(message="Added to flags", flagged_event_ids=flagged_ids)


@router.delete("/events/{event_id}")
async def remove_flag_event(
    event_id: int,
    current_user: models.User = require_auth,
    db: Session = Depends(get_db)
) -> schemas.FlagActionResponse:
    """이벤트 플래그 제거"""
    flagged_ids = json.loads(current_user.flagged_event_ids or "[]")
    
    if event_id not in flagged_ids:
        return schemas.FlagActionResponse(message="Not flagged", flagged_event_ids=flagged_ids)
    
    flagged_ids.remove(event_id)
    current_user.flagged_event_ids = json.dumps(flagged_ids)
    db.commit()
    
    return schemas.FlagActionResponse(message="Removed from flags", flagged_event_ids=flagged_ids)


@router.get("/events")
async def get_flagged_events(
    current_user: models.User = require_auth,
    db: Session = Depends(get_db)
) -> List[schemas.EventResponse]:
    """사용자의 플래그한 이벤트 목록 조회"""
    flagged_ids = json.loads(current_user.flagged_event_ids or "[]")
    
    if not flagged_ids:
        return []
    
    events = db.query(models.Event).filter(models.Event.id.in_(flagged_ids)).all()
    return events
