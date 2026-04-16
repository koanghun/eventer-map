from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List

from db import get_db, models, schemas
from utils.normalization import normalize_text, json_to_aliases
from utils.auth import require_admin, require_auth, require_auth_or_internal
from crud import crud_performer
from services import performer_service

router = APIRouter(prefix="/performers", tags=["performers"])

@router.get("/")
def get_performers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)) -> List[schemas.PerformerResponse]:
    """모든 출연자 조회"""
    return crud_performer.get_multi(db, skip=skip, limit=limit)


@router.get("/check-duplicate")
def check_duplicate_performer(name: str = Query(..., min_length=1), db: Session = Depends(get_db)) -> schemas.PerformerDuplicateResponse:
    """
    출연자 생성 전 중복 체크
    """
    normalized = normalize_text(name)
    
    # 1. 정규화된 이름으로 정확 매칭
    exact = crud_performer.get_by_normalized_name(db, normalized)
    if exact:
        return schemas.PerformerDuplicateResponse(
            status="duplicate",
            exact_match=schemas.PerformerResponse.model_validate(exact),
            similar_matches=[]
        )
    
    # 2. 별칭에서 검색
    similar = crud_performer.search_by_alias(db, name)
    if similar:
        return schemas.PerformerDuplicateResponse(
            status="similar_found",
            exact_match=None,
            similar_matches=[schemas.PerformerResponse.model_validate(p) for p in similar]
        )
    
    return schemas.PerformerDuplicateResponse(
        status="no_duplicate",
        exact_match=None,
        similar_matches=[]
    )

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_performer(
    performer: schemas.PerformerCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = require_auth_or_internal
) -> schemas.PerformerCreateResponse:
    """
    새 출연자 생성 (중복 시 기존 데이터와 병합 시도)
    """
    performer_obj, status_code = performer_service.create_or_merge_performer(db, performer)
    
    # 메시지 결정
    if status_code == 'created':
        message = "새로운 출연자가 생성되었습니다"
    elif status_code == 'merged':
        message = "기존 출연자에 별칭이 추가되었습니다"
    else:
        message = "이미 동일한 출연자가 존재합니다"

    # 응답 객체 생성
    response_data = schemas.PerformerCreateResponse(
        status=status_code,
        message=message,
        performer=schemas.PerformerResponse.model_validate(performer_obj)
    )

    # 생성인 경우 201, 그 외엔 200 반환 (성공 처리)
    if status_code == 'created':
        return response_data
    
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=response_data.model_dump(mode='json')
    )

@router.get("/search")
def search_performers(query: str = Query(..., min_length=1), db: Session = Depends(get_db)) -> List[schemas.PerformerResponse]:
    """
    출연자 검색 (정규화 명칭 + 공식 명칭 + 별칭 고려)
    """
    normalized_query = normalize_text(query)
    
    # 1. 정규화된 이름으로 검색
    by_normalized = db.query(models.Performer).filter(
        models.Performer.normalized_name.contains(normalized_query)
    ).all()
    
    # 2. 별칭으로 검색
    by_alias = crud_performer.search_by_alias(db, query)
    
    # 3. 공식 명칭으로 부분 일치 검색 (대소문자 무시)
    by_canonical = db.query(models.Performer).filter(
        models.Performer.canonical_name.ilike(f"%{query}%")
    ).all()
    
    # 중복 제거 (ID 기준)
    all_results = by_normalized + by_alias + by_canonical
    unique_results = {p.id: p for p in all_results}.values()
    
    return list(unique_results)


@router.get("/suggest")
def suggest_performers(
    query: str = Query(..., min_length=1),
    limit: int = 10,
    db: Session = Depends(get_db)
) -> List[schemas.PerformerResponse]:
    """출연자를 자동완성 검색합니다. (부분 일치 지원)"""
    return crud_performer.suggest_performers(db, query, limit=limit)


@router.put("/{performer_id}")
def update_performer(
    performer_id: int, 
    performer_data: schemas.PerformerUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
) -> schemas.PerformerResponse:
    """출연자 정보 수정"""
    db_performer = crud_performer.get(db, id=performer_id)
    if not db_performer:
        raise HTTPException(status_code=404, detail="출연자를 찾을 수 없습니다")
    
    try:
        return crud_performer.update(db, db_obj=db_performer, obj_in=performer_data)
    except Exception:
        raise HTTPException(status_code=409, detail="이미 존재하는 이름이거나 업데이트 중 오류가 발생했습니다")


@router.delete("/{performer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_performer(
    performer_id: int, 
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
) -> None:
    """출연자 삭제 (관리자 전용)"""
    db_performer = crud_performer.get(db, id=performer_id)
    if not db_performer:
        raise HTTPException(status_code=404, detail="출연자를 찾을 수 없습니다")
        
    crud_performer.remove(db, id=performer_id)
    return None
