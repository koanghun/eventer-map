from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from db.models import Event, Performer
from db.schemas import EventCreate, EventUpdate

def get(db: Session, id: int, include_hidden: bool = False) -> Optional[Event]:
    """ID로 이벤트 조회"""
    query = db.query(Event).options(
        joinedload(Event.performers_rel),
        joinedload(Event.place)
    ).filter(Event.id == id)
    
    if not include_hidden:
        query = query.filter(Event.is_hidden == False)
        
    return query.first()

def get_multi(db: Session, skip: int = 0, limit: int = 100, include_hidden: bool = False) -> List[Event]:
    """다중 이벤트 조회 (Pagination)"""
    query = db.query(Event).options(
        joinedload(Event.performers_rel),
        joinedload(Event.place)
    )
    
    if not include_hidden:
        query = query.filter(Event.is_hidden == False)
        
    return query.offset(skip).limit(limit).all()

def get_by_date(db: Session, event_date: str) -> List[Event]:
    """특정 날짜의 이벤트 조회"""
    return db.query(Event).options(
        joinedload(Event.performers_rel),
        joinedload(Event.place)
    ).filter(
        Event.event_date == event_date,
        Event.is_hidden == False
    ).all()

def create(db: Session, obj_in: EventCreate, creator_id: Optional[int] = None) -> Event:
    """새 이벤트 생성"""
    event_dict = obj_in.model_dump(exclude={'performer_ids'})
    db_obj = Event(**event_dict)
    
    if obj_in.performer_ids:
        performers = db.query(Performer).filter(Performer.id.in_(obj_in.performer_ids)).all()
        db_obj.performers_rel = performers
        
    if creator_id:
        db_obj.created_by = creator_id
        db_obj.updated_by = creator_id
        
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update(db: Session, db_obj: Event, obj_in: EventUpdate, updater_id: Optional[int] = None) -> Event:
    """기존 이벤트 정보 수정"""
    update_data = obj_in.model_dump(exclude_unset=True, exclude={'performer_ids'})
    
    # 출연자 처리
    if "performer_ids" in obj_in.model_fields_set:
        db_obj.performers_rel = []
        if obj_in.performer_ids:
            performers = db.query(Performer).filter(Performer.id.in_(obj_in.performer_ids)).all()
            db_obj.performers_rel = performers
            
    for field, value in update_data.items():
        setattr(db_obj, field, value)
        
    if updater_id:
        db_obj.updated_by = updater_id
        
    db.commit()
    db.refresh(db_obj)
    return db_obj

def remove_soft(db: Session, db_obj: Event) -> Event:
    """이벤트 논리 삭제 (Soft Delete)"""
    db_obj.is_hidden = True
    db.commit()
    db.refresh(db_obj)
    return db_obj
