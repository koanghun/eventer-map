from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from db import get_db
from db import models
from db import schemas
from utils.normalization import normalize_text
from utils.event_duplicate import calculate_event_similarity, find_duplicate_events
from utils.auth import require_auth, require_admin, require_auth_or_internal
from utils.event_history import create_event_history, get_event_history_with_user_info

# 추가된 중복 체크용 유틸
from utils.event_duplicate import find_duplicate_events

router = APIRouter(prefix="/events", tags=["events"])


@router.post("/sync", response_model=schemas.EventResponse)
def sync_event(
    event: schemas.EventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth_or_internal
):
    """
    이벤트를 동기화(중복 검사 후 생성)합니다.
    유사도가 높은 기존 이벤트가 있을 경우 생성을 건너뛰고 기존 이벤트를 반환합니다.
    """
    # 1. 중복 검사용 임시 객체 생성
    event_dict = event.model_dump(exclude={'performer_ids'})
    temp_event = models.Event(**event_dict)
    
    # 장소 정보 로드 (유사도 계산용 필수)
    if temp_event.place_id:
        temp_event.place = db.query(models.Place).filter(models.Place.id == temp_event.place_id).first()
        
    # 출연자 정보 로드
    if event.performer_ids:
        performers = db.query(models.Performer).filter(
            models.Performer.id.in_(event.performer_ids)
        ).all()
        temp_event.performers_rel = performers
    else:
        temp_event.performers_rel = []

    # 2. 중복 검사
    duplicates = find_duplicate_events(db, temp_event)
    
    if duplicates:
        best_match = duplicates[0]
        # 임계값 (예: 확실한 중복이거나 유사도 0.8 이상)
        if best_match.get("is_duplicate") or best_match.get("similarity_score", 0) >= 0.8:
            print(f"Duplicate event found (Score: {best_match['similarity_score']}): {best_match['event_title']}")
            # 기존 이벤트 객체 리턴
            existing_event = db.query(models.Event).filter(models.Event.id == best_match["event_id"]).first()
            return existing_event

    # 3. 새로운 이벤트 생성
    db_event = models.Event(**event_dict)
    if temp_event.performers_rel:
         db_event.performers_rel = temp_event.performers_rel
         
    # 생성자 정보
    db_event.created_by = current_user.id
    db_event.updated_by = current_user.id
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    # 히스토리 추가
    create_event_history(db, db_event, current_user, 'created')
    db.commit()
    
    return db_event



@router.post("/", response_model=schemas.EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event: schemas.EventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """이벤트 생성"""
    # 1. 이벤트 생성 (performer_ids 제외)
    event_dict = event.model_dump(exclude={'performer_ids'})
    db_event = models.Event(**event_dict)
    
    # 2. 출연자 처리 (ID 기반 - 권장)
    if event.performer_ids:
        performers = db.query(models.Performer).filter(
            models.Performer.id.in_(event.performer_ids)
        ).all()
        db_event.performers_rel = performers

    
    # 생성자 정보 저장
    db_event.created_by = current_user.id
    db_event.updated_by = current_user.id
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    # 히스토리 생성
    create_event_history(db, db_event, current_user, 'created')
    db.commit()
    
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
    
    # 기본 필드 업데이트 (performer_ids 제외)
    update_data = event_update.model_dump(exclude_unset=True, exclude={'performer_ids'})
    
    # 출연자 정보가 업데이트된 경우 관계도 업데이트
    if "performer_ids" in event_update.model_fields_set:
        # ID 기반 업데이트 (권장)
        db_event.performers_rel = []
        if event_update.performer_ids:
            performers = db.query(models.Performer).filter(
                models.Performer.id.in_(event_update.performer_ids)
            ).all()
            db_event.performers_rel = performers

    
    # 수정 전 히스토리 저장
    create_event_history(db, db_event, current_user, 'updated')
    
    for field, value in update_data.items():
        setattr(db_event, field, value)
    
    # 수정자 정보 업데이트
    db_event.updated_by = current_user.id
    
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
    
    # 삭제 히스토리 저장
    create_event_history(db, db_event, current_user, 'deleted')
    
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
    event_dict = event_data.model_dump(exclude={'performer_ids'})
    temp_event = models.Event(**event_dict)
    temp_event.performers_rel = []
    
    # 장소 정보 로드 (유사도 계산용)
    if temp_event.place_id:
        temp_event.place = db.query(models.Place).filter(models.Place.id == temp_event.place_id).first()
        
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
                "location": existing.place.canonical_name if existing.place else "",
                "start_time": existing.start_time,
                "performers": [p.canonical_name for p in existing.performers_rel],
                **similarity
            })
    
    # 유사도 높은 순으로 정렬
    duplicates.sort(key=lambda x: x["similarity_score"], reverse=True)
    
    return {"duplicates": duplicates}


@router.get("/{event_id}/history", response_model=List[schemas.EventHistoryResponse])
def get_event_history(event_id: int, db: Session = Depends(get_db)):
    """
    이벤트 수정 이력 조회 (인증 불필요, 모든 유저 조회 가능)
    
    Returns:
        이벤트의 모든 수정 이력 (생성, 수정, 삭제)
    """
    # 이벤트 존재 여부 확인
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    
    # 사용자 정보와 함께 히스토리 조회
    histories = get_event_history_with_user_info(db, event_id)
    return histories


@router.post("/{event_id}/report", response_model=schemas.EventReportResponse)
def report_event(
    event_id: int,
    report_data: schemas.EventReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """
    이벤트 신고 (인증 필요)
    
    - 동일 사용자의 중복 신고 방지
    - 신고 횟수 5회 이상 시 자동 숨김 처리
    """
    # 이벤트 존재 여부 확인
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    
    # 중복 신고 방지
    existing = db.query(models.EventReport).filter(
        models.EventReport.event_id == event_id,
        models.EventReport.reporter_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reported this event"
        )
    
    # 신고 생성
    report = models.EventReport(
        event_id=event_id,
        reporter_id=current_user.id,
        reason=report_data.reason,
        description=report_data.description
    )
    db.add(report)
    
    # 이벤트 신고 횟수 증가
    event.report_count = (event.report_count or 0) + 1
    
    # 일정 신고 수 이상이면 자동 숨김
    if event.report_count >= 5:
        event.is_hidden = True
    
    db.commit()
    db.refresh(report)
    
    # 응답에 reporter 정보 포함
    return {
        "id": report.id,
        "event_id": report.event_id,
        "reporter_id": report.reporter_id,
        "reporter_name": current_user.name,
        "reason": report.reason,
        "description": report.description,
        "status": report.status,
        "created_at": report.created_at
    }


@router.get("/{event_id}/reports", response_model=List[schemas.EventReportResponse])
def get_event_reports(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    이벤트 신고 내역 조회 (관리자 전용)
    """
    # 이벤트 존재 여부 확인
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id {event_id} not found"
        )
    
    # 신고 내역 조회 (reporter 정보 조인)
    reports_with_user = db.query(models.EventReport, models.User).join(
        models.User, models.EventReport.reporter_id == models.User.id
    ).filter(
        models.EventReport.event_id == event_id
    ).all()
    
    result = []
    for report, user in reports_with_user:
        result.append({
            "id": report.id,
            "event_id": report.event_id,
            "reporter_id": report.reporter_id,
            "reporter_name": user.name,
            "reason": report.reason,
            "description": report.description,
            "status": report.status,
            "created_at": report.created_at
        })
    
    return result
