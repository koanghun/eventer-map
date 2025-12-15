from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
from utils.normalization import normalize_text
from utils.event_duplicate import calculate_event_similarity, find_duplicate_events
from utils.auth import require_auth

router = APIRouter(prefix="/events", tags=["events"])


@router.post("/", response_model=schemas.EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event: schemas.EventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """이벤트 생성"""
    # 1. 이벤트 생성
    db_event = models.Event(**event.model_dump())
    
    # 2. 출연자 처리 (ID 기반 - 권장)
    if event.performer_ids:
        performers = db.query(models.Performer).filter(
            models.Performer.id.in_(event.performer_ids)
        ).all()
        db_event.performers_rel = performers
    # 하위호환: 문자열 방식도 지원
    elif event.performers:
        performer_names = [p.strip() for p in event.performers.split(',') if p.strip()]
        for name in performer_names:
            normalized = normalize_text(name)
            performer = db.query(models.Performer).filter(
                models.Performer.normalized_name == normalized
            ).first()
            if not performer:
                performer = models.Performer(
                    canonical_name=name,
                    normalized_name=normalized
                )
                db.add(performer)
                db.flush()
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
def update_event(
    event_id: int,
    event_update: schemas.EventUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
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
    if "performer_ids" in update_data:
        # ID 기반 업데이트 (권장)
        db_event.performers_rel = []
        if update_data["performer_ids"]:
            performers = db.query(models.Performer).filter(
                models.Performer.id.in_(update_data["performer_ids"])
            ).all()
            db_event.performers_rel = performers
    elif "performers" in update_data:
        # 하위호환: 문자열 기반 업데이트
        performers_str = update_data["performers"]
        db_event.performers_rel = []
        if performers_str:
            performer_names = [p.strip() for p in performers_str.split(',') if p.strip()]
            for name in performer_names:
                normalized = normalize_text(name)
                performer = db.query(models.Performer).filter(
                    models.Performer.normalized_name == normalized
                ).first()
                if not performer:
                    performer = models.Performer(
                        canonical_name=name,
                        normalized_name=normalized
                    )
                    db.add(performer)
                    db.flush()
                db_event.performers_rel.append(performer)
    
    for field, value in update_data.items():
        setattr(db_event, field, value)
    
    db.commit()
    db.refresh(db_event)
    return db_event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
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


@router.post("/check-duplicate")
def check_duplicate_event(event_data: schemas.EventCreate, db: Session = Depends(get_db)):
    """
    이벤트 중복 여부 확인
    
    같은 날짜의 이벤트를 조회하여 다음 기준으로 유사도를 계산합니다:
    - 날짜 일치 (25%)
    - 거리 50m 이내 (20%) - 위치 정보 있는 경우
    - 시간대 30분 이내 (15%) - 시간 정보 있는 경우
    - 출연자 유사도 (25%)
    - 제목 유사도 (15%)
    
    Returns:
        list: 중복 가능성이 있는 이벤트 목록 (유사도 높은 순)
    """
    # 날짜는 필수이므로 스키마 검증에서 걸러짐
    
    # 같은 날짜의 이벤트 조회
    existing_events = db.query(models.Event).filter(
        models.Event.event_date == event_data.event_date
    ).all()
    
    if not existing_events:
        return {"duplicates": []}
    
    # 임시 이벤트 객체 생성 (출연자는 별도 처리)    
    # model_dump()는 Pydantic 모델을 딕셔너리로 변환
    # python 연산자
    # * 연산자 - 리스트/튜플 언패킹
    # ** 연산자 - 딕셔너리 언패킹
    temp_event = models.Event(**event_data.model_dump())
    temp_event.performers_rel = []
    
    # 출연자 정보 처리 (ID로 조회)
    if event_data.performer_ids:
        # 한 번의 쿼리로 모든 출연자 조회
        performers = db.query(models.Performer).filter(
            models.Performer.id.in_(event_data.performer_ids)
        ).all()
        temp_event.performers_rel = performers
    
    # 각 기존 이벤트와의 유사도 계산
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
                "performers": [p.canonical_name for p in existing.performers_rel],
                **similarity
            })
    
    # 유사도 높은 순으로 정렬
    duplicates.sort(key=lambda x: x["similarity_score"], reverse=True)
    
    return {"duplicates": duplicates}
