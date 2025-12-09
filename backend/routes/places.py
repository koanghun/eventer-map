import os
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Place
from schemas import PlaceResponse, PlaceCreate
from utils.normalization import normalize_text

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/search", response_model=PlaceResponse)
def search_place(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    """
    장소를 검색합니다.
    DB에서만 검색합니다. 없으면 404를 반환합니다.
    """
    normalized_query = normalize_text(query)
    
    # DB에서검색 (정규화된이름으로)
    place = db.query(Place).filter(
        Place.normalized_name.contains(normalized_query)
    ).first()
    
    # canonical_name으로도 검색
    if not place:
        place = db.query(Place).filter(Place.canonical_name.ilike(f"%{query}%")).first()
    
    if place:
        return place
    
    raise HTTPException(status_code=404, detail="장소를찾을수없습니다")


@router.post("/", response_model=PlaceResponse)
def create_place(
    place: PlaceCreate,
    db: Session = Depends(get_db)
):
    """
    새로운 장소를 저장합니다.
    """
    normalized = normalize_text(place.canonical_name)
    
    # 이미존재하는지 확인 (정규화된이름으로)
    existing_place = db.query(Place).filter(Place.normalized_name == normalized).first()
    if existing_place:
        return existing_place
        
    new_place = Place(
        canonical_name=place.canonical_name,
        normalized_name=normalized,
        name=place.canonical_name,  # 호환성을위해 name도 설정
        address=place.address,
        latitude=place.latitude,
        longitude=place.longitude
    )
    db.add(new_place)
    db.commit()
    db.refresh(new_place)
    
    return new_place


@router.get("/", response_model=List[PlaceResponse])
def get_all_places(db: Session = Depends(get_db)):
    """모든저장된 장소 목록을 반환합니다."""
    return db.query(Place).all()
