from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas

router = APIRouter(prefix="/events", tags=["events"])


@router.post("/", response_model=schemas.EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event: schemas.EventCreate, db: Session = Depends(get_db)):
    """이벤트 생성"""
    # 1. 이벤트 생성
    db_event = models.Event(**event.model_dump())
    
    # 2. 출연자 처리 (문자열 파싱 및 관계 설정)
    if event.performers:
        performer_names = [p.strip() for p in event.performers.split(',') if p.strip()]
        for name in performer_names:
            # 출연자가 이미 존재하는지 확인
            performer = db.query(models.Performer).filter(models.Performer.name == name).first()
            if not performer:
                # 없으면 새로 생성
                performer = models.Performer(name=name)
                db.add(performer)
                db.flush()  # ID 생성을 위해 flush
            
            # 관계 설정
            db_event.performers_rel.append(performer)
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/", response_model=List[schemas.EventResponse])
def get_events(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """모든 이벤트 조회"""
    events = db.query(models.Event).offset(skip).limit(limit).all()
    return events


@router.get("/by-date/{event_date}", response_model=List[schemas.EventResponse])
def get_events_by_date(event_date: str, db: Session = Depends(get_db)):
    """특정 날짜의 이벤트 조회 (YYYY-MM-DD 형식)"""
    events = db.query(models.Event).filter(models.Event.event_date == event_date).all()
    return events


@router.get("/{event_id}", response_model=schemas.EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """특정 이벤트 조회"""
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    return event


@router.put("/{event_id}", response_model=schemas.EventResponse)
def update_event(event_id: int, event_update: schemas.EventUpdate, db: Session = Depends(get_db)):
    """이벤트 수정"""
    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    
    # Update only provided fields
    update_data = event_update.model_dump(exclude_unset=True)
    
    # 출연자 정보가 업데이트된 경우 관계도 업데이트
    if "performers" in update_data:
        performers_str = update_data["performers"]
        # 기존 관계 초기화
        db_event.performers_rel = []
        
        if performers_str:
            performer_names = [p.strip() for p in performers_str.split(',') if p.strip()]
            for name in performer_names:
                performer = db.query(models.Performer).filter(models.Performer.name == name).first()
                if not performer:
                    performer = models.Performer(name=name)
                    db.add(performer)
                    db.flush()
                db_event.performers_rel.append(performer)
    
    for field, value in update_data.items():
        setattr(db_event, field, value)
    
    db.commit()
    db.refresh(db_event)
    return db_event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """이벤트 삭제"""
    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    
    db.delete(db_event)
    db.commit()
    return None
