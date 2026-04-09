from typing import List, Optional
from sqlalchemy.orm import Session
from db.models import Place
from db.schemas import PlaceCreate, PlaceUpdate
from utils.normalization import normalize_text, aliases_to_json, json_to_aliases

def get(db: Session, id: int) -> Optional[Place]:
    """ID로 장소 조회"""
    return db.query(Place).filter(Place.id == id).first()

def get_by_normalized_name(db: Session, normalized_name: str) -> Optional[Place]:
    """정규화된 이름으로 장소 조회"""
    return db.query(Place).filter(Place.normalized_name == normalized_name).first()

def get_by_google_id(db: Session, google_place_id: str) -> Optional[Place]:
    """Google Place ID로 장소 조회"""
    return db.query(Place).filter(Place.google_place_id == google_place_id).first()

def get_multi(db: Session, skip: int = 0, limit: int = 100) -> List[Place]:
    """다중 장소 조회 (Pagination)"""
    return db.query(Place).offset(skip).limit(limit).all()

def search_place(db: Session, query: str) -> Optional[Place]:
    """장소를 검색합니다. 정규화된 이름, 공식 명칭, 별칭 순으로 확인합니다."""
    normalized_query = normalize_text(query)
    
    # 1. 정규화된 이름으로 부분 일치 검색
    place = db.query(Place).filter(Place.normalized_name.contains(normalized_query)).first()
    if place:
        return place
        
    # 2. 공식 명칭으로 대소문자 무시 부분 일치 검색
    place = db.query(Place).filter(Place.canonical_name.ilike(f"%{query}%")).first()
    if place:
        return place
        
    # 3. 별칭에서 검색
    return search_by_alias(db, query)

def search_by_alias(db: Session, query: str) -> Optional[Place]:
    """별칭(Aliases) 목록에서 검색"""
    search_term = query.lower()
    all_places = db.query(Place).all()
    for p in all_places:
        if p.aliases:
            aliases = [a.lower() for a in json_to_aliases(p.aliases)]
            if search_term in aliases:
                return p
    return None

def create(db: Session, obj_in: PlaceCreate) -> Place:
    """새 장소 생성"""
    normalized = normalize_text(obj_in.canonical_name)
    db_obj = Place(
        canonical_name=obj_in.canonical_name,
        normalized_name=normalized,
        google_place_id=obj_in.google_place_id,
        aliases=aliases_to_json(obj_in.aliases) if obj_in.aliases else "[]",
        address=obj_in.address,
        latitude=obj_in.latitude,
        longitude=obj_in.longitude
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update(db: Session, db_obj: Place, obj_in: PlaceUpdate) -> Place:
    """기존 장소 정보 수정"""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    # 특수 필드 처리 (aliases)
    if "aliases" in update_data:
        update_data["aliases"] = aliases_to_json(update_data["aliases"])
    
    # canonical_name 변경 시 normalized_name도 업데이트
    if "canonical_name" in update_data:
        update_data["normalized_name"] = normalize_text(update_data["canonical_name"])
        
    for field, value in update_data.items():
        setattr(db_obj, field, value)
        
    db.commit()
    db.refresh(db_obj)
    return db_obj

def remove(db: Session, id: int) -> Optional[Place]:
    """장소 삭제"""
    obj = db.query(Place).get(id)
    if obj:
        db.delete(obj)
        db.commit()
    return obj
