import os
import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Place
from schemas import PlaceResponse, PlaceCreate

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
    # DB에서 검색 (정확한 이름 또는 유사한 이름)
    place = db.query(Place).filter(Place.name.ilike(f"%{query}%")).first()
    
    if place:
        return place
    
    raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")


@router.post("/", response_model=PlaceResponse)
def create_place(
    place: PlaceCreate,
    db: Session = Depends(get_db)
):
    """
    새로운 장소를 저장합니다.
    """
    # 이미 존재하는지 확인
    existing_place = db.query(Place).filter(Place.name == place.name).first()
    if existing_place:
        return existing_place
        
    new_place = Place(
        name=place.name,
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
    """모든 저장된 장소 목록을 반환합니다."""
    return db.query(Place).all()
