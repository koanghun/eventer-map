from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
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
    새 출연자 생성
    
    중복 체크를 수행하고, 중복이면 409 Conflict 반환
    Race condition 대비: DB UNIQUE 제약으로 최종 보호
    """
    normalized = normalize_text(performer.canonical_name)
    
    # 중복 체크 (DB 인덱스 사용, LIMIT 1로 첫 발견 시 즉시 반환)
    # normalized_name은 UNIQUE 제약이 있어 최대 1개만 존재
    existing = db.query(models.Performer).filter(
        models.Performer.normalized_name == normalized
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "이미 존재하는 출연자입니다",
                "existing_performer": {
                    "id": existing.id,
                    "canonical_name": existing.canonical_name
                }
            }
        )
    
    # 새 출연자 생성
    new_performer = models.Performer(
        canonical_name=performer.canonical_name,
        normalized_name=normalized,
        name=performer.canonical_name,  # 호환성
        aliases=aliases_to_json(performer.aliases)
    )
    
    try:
        db.add(new_performer)
        db.commit()
        db.refresh(new_performer)
    except IntegrityError:
        # Race condition: 동시 요청으로 인한 중복 생성 시도
        # 에러 대신 기존 출연자에 별칭 병합
        db.rollback()
        
        # 기존 출연자 조회
        existing = db.query(models.Performer).filter(
            models.Performer.normalized_name == normalized
        ).first()
        
        # 별칭 병합 (중복 제거)
        existing_aliases = set(json_to_aliases(existing.aliases))
        new_aliases = set(performer.aliases or [])
        added_aliases = new_aliases - existing_aliases
        
        if added_aliases:
            # 새로운 별칭이 있으면 병합 후 저장
            merged_aliases = list(existing_aliases | new_aliases)
            existing.aliases = aliases_to_json(merged_aliases)
            db.commit()
            db.refresh(existing)
            
            # 응답용으로 aliases를 리스트로 변환
            existing.aliases = merged_aliases
            
            return JSONResponse(
                status_code=200,
                content={
                    "status": "merged",
                    "message": "기존 출연자에 별칭이 추가되었습니다",
                    "added_aliases": list(added_aliases),
                    "performer": {
                        "id": existing.id,
                        "canonical_name": existing.canonical_name,
                        "normalized_name": existing.normalized_name,
                        "aliases": merged_aliases,
                        "name": existing.name
                    }
                }
            )
        else:
            # 새로운 별칭이 없으면 기존 항목 그대로 반환
            existing.aliases = list(existing_aliases)
            
            return JSONResponse(
                status_code=200,
                content={
                    "status": "already_exists",
                    "message": "이미 동일한 출연자가 존재합니다",
                    "performer": {
                        "id": existing.id,
                        "canonical_name": existing.canonical_name,
                        "normalized_name": existing.normalized_name,
                        "aliases": existing.aliases,
                        "name": existing.name
                    }
                }
            )
    
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
