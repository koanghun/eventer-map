from typing import Optional, Tuple, List, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from db.models import Performer
from db.schemas import PerformerCreate, PerformerUpdate
from crud import crud_performer
from utils.normalization import normalize_text, aliases_to_json, json_to_aliases

def create_or_merge_performer(db: Session, performer_in: PerformerCreate) -> Tuple[Performer, str]:
    """
    출연자를 생성하거나, 이미 존재할 경우 별칭을 병합합니다.
    
    Returns:
        (Performer, status): 
            - status: 'created' | 'merged' | 'already_exists'
    """
    normalized = normalize_text(performer_in.canonical_name)
    
    # 1. 기존 출연자 확인
    existing = crud_performer.get_by_normalized_name(db, normalized)
    
    if existing:
        # 별칭 병합 시도
        is_updated, merged_aliases = _merge_aliases(existing, performer_in.aliases)
        if is_updated:
            crud_performer.update(db, existing, PerformerUpdate(aliases=merged_aliases))
            return existing, 'merged'
        return existing, 'already_exists'

    # 2. 신규 생성 시도
    try:
        new_performer = crud_performer.create(db, performer_in)
        return new_performer, 'created'
    except IntegrityError:
        # Race condition 처리
        db.rollback()
        existing = crud_performer.get_by_normalized_name(db, normalized)
        is_updated, merged_aliases = _merge_aliases(existing, performer_in.aliases)
        if is_updated:
            crud_performer.update(db, existing, PerformerUpdate(aliases=merged_aliases))
            return existing, 'merged'
        return existing, 'already_exists'

def _merge_aliases(existing: Performer, new_aliases: Optional[List[str]]) -> Tuple[bool, List[str]]:
    """기존 출연자의 별칭 목록에 새로운 별칭을 병합합니다."""
    if not new_aliases:
        return False, json_to_aliases(existing.aliases)
        
    existing_aliases_set = set(json_to_aliases(existing.aliases))
    new_aliases_set = set(new_aliases)
    
    # 공식 명칭과 중복되는 별칭 제거
    if existing.canonical_name in new_aliases_set:
        new_aliases_set.remove(existing.canonical_name)
        
    added_aliases = new_aliases_set - existing_aliases_set
    
    if added_aliases:
        merged_aliases = list(existing_aliases_set | new_aliases_set)
        return True, merged_aliases
        
    return False, list(existing_aliases_set)
