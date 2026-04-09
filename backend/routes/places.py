from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from typing import List

from db import get_db, models
from db.schemas import PlaceResponse, PlaceCreate, PlaceUpdate
from utils.auth import require_auth, require_auth_or_internal, require_admin
from crud import crud_place
from services import place_service

router = APIRouter(prefix="/places", tags=["places"])

@router.post("/resolve", response_model=PlaceResponse)
def resolve_place(
    response: Response,
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = require_auth_or_internal
):
    """
    텍스트 공간명을 받아 장소 객체를 반환하거나 새로 생성합니다.
    (DB 검색 -> Google Maps 검색 -> 레거시 생성 순서)
    """
    place, is_created = place_service.resolve_place(db, query)
    if is_created:
        response.status_code = status.HTTP_201_CREATED
    return place

@router.get("/search", response_model=PlaceResponse)
def search_place(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    """장소를 검색합니다. (공식명칭, 정규화 명칭, 별칭 포함)"""
    place = crud_place.search_place(db, query)
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")
    return place

@router.get("/suggest", response_model=List[PlaceResponse])
def suggest_places(
    query: str = Query(..., min_length=1),
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """장소를 자동완성 검색합니다. (부분 일치 지원)"""
    return crud_place.suggest_places(db, query, limit=limit)

@router.post("/", response_model=PlaceResponse, status_code=status.HTTP_201_CREATED)
def create_place(
    place: PlaceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """
    새로운 장소를 저장합니다.
    google_place_id가 있으면 Google 정보를 기반으로 생성하거나 기존 장소와 병합합니다.
    """
    if place.google_place_id:
        try:
            return place_service.create_or_update_from_google(db, place.google_place_id, place.aliases)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    return crud_place.create(db, place)

@router.get("/", response_model=List[PlaceResponse])
def get_all_places(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """모든 저장된 장소 목록을 반환합니다."""
    return crud_place.get_multi(db, skip=skip, limit=limit)

@router.put("/{place_id}", response_model=PlaceResponse)
def update_place(
    place_id: int, 
    place_data: PlaceUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """장소 정보 수정"""
    db_place = crud_place.get(db, id=place_id)
    if not db_place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")
    
    try:
        return crud_place.update(db, db_obj=db_place, obj_in=place_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_place(
    place_id: int, 
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    """장소 삭제 (관리자 전용)"""
    db_place = crud_place.get(db, id=place_id)
    if not db_place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")
        
    crud_place.remove(db, id=place_id)
    return None
