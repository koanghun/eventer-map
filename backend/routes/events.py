from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List

from db import get_db, models, schemas
from utils.auth import require_auth, require_admin, require_auth_or_internal
from utils.event_history import get_event_history_with_user_info
from utils.event_duplicate import calculate_event_similarity, find_duplicate_events
from crud import crud_event, crud_place, crud_performer
from services import event_service

router = APIRouter(prefix="/events", tags=["events"])

@router.post("/sync", response_model=schemas.EventResponse)
def sync_event(
    event: schemas.EventCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth_or_internal
):
    """이벤트를 동기화(중복 검사 후 생성/병합)합니다."""
    db_event, is_created = event_service.sync_event(db, event, current_user)
    if is_created:
        response.status_code = status.HTTP_201_CREATED
    return db_event

@router.post("/", response_model=schemas.EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event: schemas.EventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """새로운 이벤트를 생성합니다."""
    return event_service.create_event(db, event, current_user)

@router.get("/", response_model=List[schemas.EventResponse])
def get_events(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """숨김 처리되지 않은 모든 이벤트를 조회합니다."""
    return crud_event.get_multi(db, skip=skip, limit=limit)

@router.get("/by-date/{event_date}", response_model=List[schemas.EventResponse])
def get_events_by_date(event_date: str, db: Session = Depends(get_db)):
    """특정 날짜의 이벤트를 조회합니다 (YYYY-MM-DD)."""
    return crud_event.get_by_date(db, event_date)

@router.get("/{event_id}", response_model=schemas.EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """ID로 특정 이벤트를 조회합니다."""
    db_event = crud_event.get(db, event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    return db_event

@router.put("/{event_id}", response_model=schemas.EventResponse)
def update_event(
    event_id: int,
    event_update: schemas.EventUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """이벤트 정보를 수정합니다."""
    db_event = event_service.update_event(db, event_id, event_update, current_user)
    if not db_event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    return db_event

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """이벤트를 논리 삭제합니다."""
    db_event = crud_event.get(db, event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    
    # 히스토리 기록 및 삭제 처리
    from utils.event_history import create_event_history
    create_event_history(db, db_event, current_user, 'deleted')
    crud_event.remove_soft(db, db_event)
    return None

@router.post("/check-duplicate")
def check_duplicate_event(event_data: schemas.EventCreate, db: Session = Depends(get_db)):
    """이벤트 중복 여부를 확인합니다."""
    # 중복 검사용 임시 객체 생성
    event_dict = event_data.model_dump(exclude={'performer_ids'})
    temp_event = models.Event(**event_dict)
    
    if temp_event.place_id:
        temp_event.place = crud_place.get(db, temp_event.place_id)
    
    if event_data.performer_ids:
        temp_event.performers_rel = db.query(models.Performer).filter(
            models.Performer.id.in_(event_data.performer_ids)
        ).all()
        
    duplicates = find_duplicate_events(db, temp_event)
    return {"duplicates": duplicates}

@router.get("/{event_id}/history", response_model=List[schemas.EventHistoryResponse])
def get_event_history(event_id: int, db: Session = Depends(get_db)):
    """이벤트의 모든 수정 이력을 조회합니다."""
    db_event = crud_event.get(db, event_id, include_hidden=True)
    if not db_event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    return get_event_history_with_user_info(db, event_id)

@router.post("/{event_id}/report", response_model=schemas.EventReportResponse)
def report_event(
    event_id: int,
    report_data: schemas.EventReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """이벤트를 신고합니다."""
    db_event = crud_event.get(db, event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")
    
    # 중복 신고 방지
    existing = db.query(models.EventReport).filter(
        models.EventReport.event_id == event_id,
        models.EventReport.reporter_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="이미 이 이벤트를 신고하셨습니다")
    
    # 신고 생성
    report = models.EventReport(
        event_id=event_id,
        reporter_id=current_user.id,
        reason=report_data.reason,
        description=report_data.description
    )
    db.add(report)
    
    # 신고 횟수 카운트 및 자동 숨김
    db_event.report_count = (db_event.report_count or 0) + 1
    if db_event.report_count >= 5:
        db_event.is_hidden = True
    
    db.commit()
    db.refresh(report)
    
    return {
        **report.__dict__,
        "reporter_name": current_user.name
    }

@router.get("/{event_id}/reports", response_model=List[schemas.EventReportResponse])
def get_event_reports(
    event_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    """이벤트 신고 내역을 조회합니다 (관리자 전용)."""
    reports_with_user = db.query(models.EventReport, models.User).join(
        models.User, models.EventReport.reporter_id == models.User.id
    ).filter(models.EventReport.event_id == event_id).all()
    
    return [{
        **r[0].__dict__,
        "reporter_name": r[1].name
    } for r in reports_with_user]
