from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
from utils.normalization import normalize_text, aliases_to_json, json_to_aliases

router = APIRouter(prefix="/performers", tags=["performers"])


@router.get("/", response_model=List[schemas.PerformerResponse])
def get_performers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """모든출연자 조회"""
    performers = db.query(models.Performer).offset(skip).limit(limit).all()
    # aliases JSON 문자열을 리스트로 변환
    for p in performers:
        p.aliases = json_to_aliases(p.aliases)
    return performers


@router.get("/check-duplicate")
def check_duplicate_performer(name: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """
    출연자생성 전 중복 체크
    
    Returns:
        - status: 'duplicate' (정확일치) | 'similar_found' (별칭일치) | 'no_duplicate'
        - existing_performer: 기존출연자 정보 (중복시)
    """
    normalized = normalize_text(name)
    
    # 1. 정규화된 이름으로 정확 매칭
    exact = db.query(models.Performer).filter(
        models.Performer.normalized_name == normalized
    ).first()
    
    if exact:
        exact.aliases = json_to_aliases(exact.aliases)
        return {
            "status": "duplicate",
            "exact_match": exact,
            "similar_matches": []
        }
    
    # 2. 별칭에서 검색 (JSON LIKE 사용)
    similar = db.query(models.Performer).filter(
        models.Performer.aliases.like(f'%"{name}"%')
    ).limit(5).all()
    
    if similar:
        for p in similar:
            p.aliases = json_to_aliases(p.aliases)
        return {
            "status": "similar_found",
            "exact_match": None,
            "similar_matches": similar
        }
    
    return {
        "status": "no_duplicate",
        "exact_match": None,
        "similar_matches": []
    }


@router.post("/", response_model=schemas.PerformerResponse)
def create_performer(performer: schemas.PerformerCreate, db: Session = Depends(get_db)):
    """
    새출연자 생성
    
    중복 체크를 수행하고, 중복이면 409 Conflict 반환
    """
    normalized = normalize_text(performer.canonical_name)
    
    # 중복 체크
    existing = db.query(models.Performer).filter(
        models.Performer.normalized_name == normalized
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "이미존재하는출연자입니다",
                "existing_performer": {
                    "id": existing.id,
                    "canonical_name": existing.canonical_name
                }
            }
        )
    
    # 새출연자 생성
    new_performer = models.Performer(
        canonical_name=performer.canonical_name,
        normalized_name=normalized,
        name=performer.canonical_name,  # 호환성
        aliases=aliases_to_json(performer.aliases)
    )
    
    db.add(new_performer)
    db.commit()
    db.refresh(new_performer)
    
    # 응답 시 aliases를 리스트로 변환
    new_performer.aliases = json_to_aliases(new_performer.aliases)
    
    return new_performer


@router.get("/search", response_model=List[schemas.PerformerResponse])
def search_performers(query: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """
    출연자검색 (정규화 + 별칭 고려)
    """
    normalized_query = normalize_text(query)
    
    # 1. 정규화된이름으로 검색
    by_normalized = db.query(models.Performer).filter(
        models.Performer.normalized_name.contains(normalized_query)
    ).all()
    
    # 2. 별칭으로 검색
    by_alias = db.query(models.Performer).filter(
        models.Performer.aliases.like(f'%"{query}"%')
    ).all()
    
    # 3. canonical_name으로도 검색 (부분일치)
    by_canonical = db.query(models.Performer).filter(
        models.Performer.canonical_name.ilike(f"%{query}%")
    ).all()
    
    # 중복 제거
    performers_dict = {p.id: p for p in (by_normalized + by_alias + by_canonical)}
    performers = list(performers_dict.values())
    
    # aliases JSON 문자열을 리스트로 변환
    for p in performers:
        p.aliases = json_to_aliases(p.aliases)
    
    return performers
