import os
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from typing import List
from db import get_db
from db import models
from db.models import Place

from db.schemas import PlaceResponse, PlaceCreate, PlaceUpdate
from utils.normalization import normalize_text, json_to_aliases, aliases_to_json
from utils.auth import require_auth, require_auth_or_internal, require_admin
from utils.google_maps import get_place_details, search_place_by_text

router = APIRouter(prefix="/places", tags=["places"])


@router.post("/resolve", response_model=PlaceResponse)
def resolve_place(
    response: Response,
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = require_auth_or_internal
):

    """
    텍스트 공간명을 받아 장소 인스턴스를 반환합니다.
    1. DB 검색 (canonical_name, aliases)
    2. 없을 경우 Google Maps Text Search -> Place ID 획득
    3. Place ID로 상세 정보 로드 후 DB 생성 및 반환
    """
    normalized_query = normalize_text(query)
    
    # 1. 기존 DB에서 장소 검색 (search_place 로직 재사용)
    # 1-1. normalized_name 검색
    place = db.query(Place).filter(Place.normalized_name == normalized_query).first()
    if place:
        # 기존에 좌표가 없던 경우 복구 시도 (Coordinates healing)
        if place.latitude is None or place.longitude is None:
            print(f"Healing place coordinates: {query}")
            google_place_id = search_place_by_text(query)
            if google_place_id:
                details = get_place_details(google_place_id, language='ja')
                if details:
                    geometry = details.get('geometry', {})
                    location_geo = geometry.get('location', {})
                    place.latitude = location_geo.get('lat')
                    place.longitude = location_geo.get('lng')
                    if not place.google_place_id:
                        place.google_place_id = google_place_id
                    if details.get('formatted_address') and not place.address:
                        place.address = details.get('formatted_address')
                    db.commit()
                    db.refresh(place)
        return place

        
    # 1-2. aliases 검색
    all_places = db.query(Place).all()
    for p in all_places:
        if query.lower() in [a.lower() for a in json_to_aliases(p.aliases)]:
            return p
            
    # 2. DB에 없으면 Google Maps 검색 (괄호 제거 등 정제)
    print(f"Resolving place from Google Maps: {query}")
    google_place_id = search_place_by_text(query)

    
    if google_place_id:
        # 중복 방지 (다시 한 번 google_place_id로 조회)
        existing_place = db.query(Place).filter(Place.google_place_id == google_place_id).first()
        if existing_place:
            return existing_place
            
        # 상세 정보 가져와 생성
        details = get_place_details(google_place_id, language='ja')
        if details:
            g_name = details.get('name', query)
            g_address = details.get('formatted_address', "")
            geometry = details.get('geometry', {})
            location_geo = geometry.get('location', {})
            lat = location_geo.get('lat')
            lng = location_geo.get('lng')
            
            new_place = Place(
                canonical_name=g_name,
                normalized_name=normalize_text(g_name),
                google_place_id=google_place_id,
                aliases=aliases_to_json([query] if query != g_name else []),
                address=g_address,
                latitude=lat,
                longitude=lng
            )
            db.add(new_place)
            db.commit()
            db.refresh(new_place)
            response.status_code = status.HTTP_201_CREATED
            return new_place


    # 3. Google Maps 검색도 실패한 경우 레거시 생성 (좌표/주소 없음)
    new_place = Place(
        canonical_name=query,
        normalized_name=normalized_query,
        aliases=aliases_to_json([]),
        address=None,
        latitude=None,
        longitude=None,
        google_place_id=None
    )
    db.add(new_place)
    db.commit()
    db.refresh(new_place)
    response.status_code = status.HTTP_201_CREATED
    return new_place




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
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """
    새로운 장소를 저장합니다.
    google_place_id가 제공된 경우 Google Maps API에서 상세 정보를 가져와 정규화합니다.
    """
    # 1. google_place_id로 중복 확인
    if place.google_place_id:
        existing_place = db.query(Place).filter(Place.google_place_id == place.google_place_id).first()
        if existing_place:
            # 기존 장소 발견 - 새로운 별칭 병합 (필요 시)
            existing_aliases = json_to_aliases(existing_place.aliases)
            updated = False
            
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

    # 2. Google Maps API에서 정보 가져오기 (google_place_id가 있는 경우)
    if place.google_place_id:
        print(f"Fetching details for google_place_id: {place.google_place_id}")
        details = get_place_details(place.google_place_id, language='ja')  # 일본어 우선
        
        if details:
            g_name = details.get('name', place.canonical_name)
            g_address = details.get('formatted_address', place.address)
            geometry = details.get('geometry', {})
            location = geometry.get('location', {})
            lat = location.get('lat', place.latitude)
            lng = location.get('lng', place.longitude)
            
            normalized = normalize_text(g_name)
            
            # 사용자 입력명을 별칭으로 추가
            initial_aliases = place.aliases if place.aliases else []
            if place.canonical_name and place.canonical_name != g_name:
                if place.canonical_name not in initial_aliases:
                    initial_aliases.append(place.canonical_name)

            new_place = Place(
                canonical_name=g_name,
                normalized_name=normalized,
                google_place_id=place.google_place_id,
                aliases=aliases_to_json(initial_aliases),
                address=g_address,
                latitude=lat,
                longitude=lng
            )
            db.add(new_place)
            db.commit()
            db.refresh(new_place)
            return new_place

    # 3. Google Place ID가 없거나 실패한 경우 레거시 방식으로 처리
    normalized = normalize_text(place.canonical_name)
    existing_place = db.query(Place).filter(Place.normalized_name == normalized).first()
    
    if existing_place:
        existing_aliases = json_to_aliases(existing_place.aliases)
        updated = False
        
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
    
    new_place = Place(
        canonical_name=place.canonical_name,
        normalized_name=normalized,
        aliases=aliases_to_json(place.aliases if place.aliases else []),
        address=place.address,
        latitude=place.latitude,
        longitude=place.longitude,
        google_place_id=place.google_place_id
    )
    db.add(new_place)
    db.commit()
    db.refresh(new_place)
    
    return new_place


@router.get("/", response_model=List[PlaceResponse])
def get_all_places(db: Session = Depends(get_db)):
    """모든 저장된 장소 목록을 반환합니다."""
    return db.query(Place).all()


@router.put("/{place_id}", response_model=PlaceResponse)
def update_place(
    place_id: int, 
    place_data: PlaceUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = require_auth
):
    """장소 정보 수정"""
    db_place = db.query(Place).filter(Place.id == place_id).first()
    if not db_place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")
    
    if place_data.canonical_name:
        db_place.canonical_name = place_data.canonical_name
        db_place.normalized_name = normalize_text(place_data.canonical_name)
    
    if place_data.address is not None:
        db_place.address = place_data.address
        
    if place_data.latitude is not None:
        db_place.latitude = place_data.latitude
        
    if place_data.longitude is not None:
        db_place.longitude = place_data.longitude
        
    if place_data.google_place_id is not None:
        db_place.google_place_id = place_data.google_place_id
        
    if place_data.aliases is not None:
        db_place.aliases = aliases_to_json(place_data.aliases)
        
    try:
        db.commit()
        db.refresh(db_place)
        return db_place
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{place_id}", status_code=204)
def delete_place(
    place_id: int, 
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    """장소 삭제 (관리자 전용)"""
    db_place = db.query(Place).filter(Place.id == place_id).first()
    if not db_place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다")
        
    db.delete(db_place)
    db.commit()
    return None
