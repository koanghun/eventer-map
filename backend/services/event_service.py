from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from db import models, schemas
from crud import crud_event, crud_performer, crud_place
from utils.event_duplicate import find_duplicate_events
from utils.event_history import create_event_history

def sync_event(db: Session, event_in: schemas.EventCreate, current_user: models.User) -> Tuple[models.Event, bool]:
    """
    이벤트를 동기화합니다. 중복이 발견되면 기존 이벤트를 반환하고, 
    없으면 새로 생성합니다.
    
    Returns:
        (Event, is_created): 이벤트 객체와 신규 생성 여부
    """
    # 1. 중복 검사용 임시 객체 준비 (관계 데이터 포함)
    event_dict = event_in.model_dump(exclude={'performer_ids'})
    temp_event = models.Event(**event_dict)
    
    if temp_event.place_id:
        temp_event.place = crud_place.get(db, temp_event.place_id)
        
    if event_in.performer_ids:
        performers = db.query(models.Performer).filter(
            models.Performer.id.in_(event_in.performer_ids)
        ).all()
        temp_event.performers_rel = performers
    else:
        temp_event.performers_rel = []

    # 2. 중복 검사 실행
    duplicates = find_duplicate_events(db, temp_event)
    
    if duplicates:
        best_match = duplicates[0]
        # 확실한 중복이거나 유사도가 높은 경우 (0.8 이상)
        if best_match.get("is_duplicate") or best_match.get("similarity_score", 0) >= 0.8:
            existing_event = crud_event.get(db, best_match["event_id"])
            
            # 출연자 병합 로직
            if temp_event.performers_rel:
                _merge_performers(db, existing_event, temp_event.performers_rel)
                
            return existing_event, False

    # 3. 중복이 없으면 신규 생성
    new_event = crud_event.create(db, event_in, creator_id=current_user.id)
    create_event_history(db, new_event, current_user, 'created')
    db.commit()
    
    # 관계 데이터를 포함하여 정식으로 다시 조회
    return crud_event.get(db, new_event.id), True

def create_event(db: Session, event_in: schemas.EventCreate, current_user: models.User) -> models.Event:
    """새 이벤트를 생성하고 히스토리를 기록합니다."""
    db_event = crud_event.create(db, event_in, creator_id=current_user.id)
    create_event_history(db, db_event, current_user, 'created')
    db.commit()
    return db_event

def update_event(db: Session, event_id: int, event_in: schemas.EventUpdate, current_user: models.User) -> models.Event:
    """이벤트를 수정하고 히스토리를 기록합니다."""
    db_event = crud_event.get(db, event_id)
    if not db_event:
        return None
        
    # 수정 전 히스토리 저장
    create_event_history(db, db_event, current_user, 'updated')
    
    updated_event = crud_event.update(db, db_event, event_in, updater_id=current_user.id)
    return updated_event

def _merge_performers(db: Session, existing_event: models.Event, new_performers: List[models.Performer]) -> None:
    """기존 이벤트에 새로운 출연자를 병합합니다."""
    existing_ids = {p.id for p in existing_event.performers_rel}
    updated = False
    for p in new_performers:
        if p.id not in existing_ids:
            existing_event.performers_rel.append(p)
            updated = True
            
    if updated:
        db.commit()
        db.refresh(existing_event)
