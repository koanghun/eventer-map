from typing import List, Optional
from sqlalchemy.orm import Session
from db.models import Performer
from db.schemas import PerformerCreate, PerformerUpdate
from utils.normalization import normalize_text, aliases_to_json, json_to_aliases

def get(db: Session, id: int) -> Optional[Performer]:
    """ID로 출연자 조회"""
    return db.query(Performer).filter(Performer.id == id).first()

def get_by_normalized_name(db: Session, normalized_name: str) -> Optional[Performer]:
    """정규화된 이름으로 출연자 조회"""
    return db.query(Performer).filter(Performer.normalized_name == normalized_name).first()

def get_multi(db: Session, skip: int = 0, limit: int = 100) -> List[Performer]:
    """다중 출연자 조회 (Pagination)"""
    return db.query(Performer).offset(skip).limit(limit).all()

def search_by_alias(db: Session, name: str) -> List[Performer]:
    """별칭(Aliases) 목록에서 검색 (일부 일치 또는 JSON 포함 확인)"""
    # SQLite LIKE 검색 활용
    return db.query(Performer).filter(Performer.aliases.like(f'%"{name}"%')).all()

def create(db: Session, obj_in: PerformerCreate) -> Performer:
    """새 출연자 생성"""
    normalized = normalize_text(obj_in.canonical_name)
    db_obj = Performer(
        canonical_name=obj_in.canonical_name,
        normalized_name=normalized,
        aliases=aliases_to_json(obj_in.aliases) if obj_in.aliases else "[]"
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update(db: Session, db_obj: Performer, obj_in: PerformerUpdate) -> Performer:
    """기존 출연자 정보 수정"""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    if "aliases" in update_data:
        update_data["aliases"] = aliases_to_json(update_data["aliases"])
        
    if "canonical_name" in update_data:
        update_data["normalized_name"] = normalize_text(update_data["canonical_name"])
        
    for field, value in update_data.items():
        setattr(db_obj, field, value)
        
    db.commit()
    db.refresh(db_obj)
    return db_obj

def remove(db: Session, id: int) -> Optional[Performer]:
    """출연자 삭제"""
    obj = db.query(Performer).get(id)
    if obj:
        db.delete(obj)
        db.commit()
    return obj
