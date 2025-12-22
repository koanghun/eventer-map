from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from utils.auth import require_auth
import models
import json

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.post("/events/{event_id}")
async def add_favorite_event(
    event_id: int,
    current_user: models.User = require_auth,
    db: Session = Depends(get_db)
):
    """즐겨찾기 이벤트 추가"""
    # 이벤트 존재 확인
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # 현재 즐겨찾기 목록 가져오기
    favorite_ids = json.loads(current_user.favorite_event_ids or "[]")
    
    # 이미 추가된 경우 스킵
    if event_id in favorite_ids:
        return {"message": "Already favorited", "favorite_event_ids": favorite_ids}
    
    # 추가
    favorite_ids.append(event_id)
    current_user.favorite_event_ids = json.dumps(favorite_ids)
    db.commit()
    
    return {"message": "Added to favorites", "favorite_event_ids": favorite_ids}


@router.delete("/events/{event_id}")
async def remove_favorite_event(
    event_id: int,
    current_user: models.User = require_auth,
    db: Session = Depends(get_db)
):
    """즐겨찾기 이벤트 제거"""
    favorite_ids = json.loads(current_user.favorite_event_ids or "[]")
    
    if event_id not in favorite_ids:
        return {"message": "Not in favorites", "favorite_event_ids": favorite_ids}
    
    favorite_ids.remove(event_id)
    current_user.favorite_event_ids = json.dumps(favorite_ids)
    db.commit()
    
    return {"message": "Removed from favorites", "favorite_event_ids": favorite_ids}


@router.get("/events")
async def get_favorite_events(
    current_user: models.User = require_auth,
    db: Session = Depends(get_db)
):
    """사용자의 즐겨찾기 이벤트 목록 조회"""
    favorite_ids = json.loads(current_user.favorite_event_ids or "[]")
    
    if not favorite_ids:
        return []
    
    events = db.query(models.Event).filter(models.Event.id.in_(favorite_ids)).all()
    return events
