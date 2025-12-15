import os
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Place
from schemas import PlaceResponse, PlaceCreate
from utils.normalization import normalize_text, json_to_aliases, aliases_to_json

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/search", response_model=PlaceResponse)
def search_place(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    """
    장소를 검색합니다. canonical_name, normalized_name, aliases 모두에서 검색합니다.
    """
    normalized_query = normalize_text(query)
    
    # 1. normalized_name 검색 (정규화된 이름으로)
    place = db.query(Place).filter(
        Place.normalized_name.contains(normalized_query)
    ).first()
    
    if place:
        return place
    
    # 2. canonical_name 검색 (대소문자 무시)
    place = db.query(Place).filter(
        Place.canonical_name.ilike(f"%{query}%")
    ).first()
    
    if place:
        return place
    
    # 3. aliases 검색 (모든 별칭에서 검색)
    all_places = db.query(Place).all()
    for p in all_places:
        aliases = json_to_aliases(p.aliases)
        # 각 별칭을 정규화해서 비교
        for alias in aliases:
            normalized_alias = normalize_text(alias)
            if normalized_query in normalized_alias:
                return p
            # 원본 비교도 수행 (대소문자 무시)
            if query.lower() in alias.lower():
                return p
    
    raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")


@router.post("/", response_model=PlaceResponse)
def create_place(
    place: PlaceCreate,
    db: Session = Depends(get_db)
):
    """
    새로운 장소를 저장합니다.
    프론트엔드에서 전달받은 aliases(사용자 입력)를 저장하여 다국어 검색을 지원합니다.
    """
    normalized = normalize_text(place.canonical_name)
    
    # 이미 존재하는지 확인 (정규화된 이름으로)
    existing_place = db.query(Place).filter(Place.normalized_name == normalized).first()
    
    if existing_place:
        # 기존 장소 발견 - 새로운 별칭 병합
        existing_aliases = json_to_aliases(existing_place.aliases)
        updated = False
        
        # 프론트엔드에서 전달받은 aliases 추가
        if place.aliases:
            for alias in place.aliases:
                if alias and alias not in existing_aliases and alias != existing_place.canonical_name:
                    existing_aliases.append(alias)
                    updated = True
        
        if updated:
            existing_place.aliases = aliases_to_json(existing_aliases)
            db.commit()
            db.refresh(existing_place)
        
        return existing_place
    
    # 새 장소 생성
    initial_aliases = place.aliases if place.aliases else []
    new_place = Place(
        canonical_name=place.canonical_name,
        normalized_name=normalized,
        aliases=aliases_to_json(initial_aliases),  # 프론트엔드에서 전달받은 aliases 사용
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
