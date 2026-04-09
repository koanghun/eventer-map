from typing import Optional, Tuple
from sqlalchemy.orm import Session
from db.models import Place
from db.schemas import PlaceCreate, PlaceUpdate
from crud import crud_place
from utils.normalization import normalize_text, aliases_to_json, json_to_aliases
from utils.google_maps import get_place_details, search_place_by_text

def resolve_place(db: Session, query: str) -> Tuple[Place, bool]:
    """
    텍스트 공간명을 받아 장소 인스턴스를 반환하거나 생성합니다.
    
    Returns:
        (Place, is_created): 장소 객체와 신규 생성 여부
    """
    normalized_query = normalize_text(query)
    
    # 1. DB에서 먼저 검색 (공식 이름 또는 별칭)
    # 1-1. 정규화된 이름으로 검색
    place = crud_place.get_by_normalized_name(db, normalized_query)
    if place:
        # 좌표가 없는 경우 복구 시도 (Coordinates healing)
        if place.latitude is None or place.longitude is None:
            _heal_place_coordinates(db, place, query)
        return place, False
        
    # 1-2. 별칭으로 검색
    place = crud_place.search_by_alias(db, query)
    if place:
        return place, False
        
    # 2. DB에 없으면 Google Maps 검색
    google_place_id = search_place_by_text(query)
    
    if google_place_id:
        # Google Place ID로 다시 한 번 중복 확인
        existing_place = crud_place.get_by_google_id(db, google_place_id)
        if existing_place:
            return existing_place, False
            
        # 상세 정보 가져와서 신규 생성
        details = get_place_details(google_place_id, language='ja')
        if details:
            g_name = details.get('name', query)
            g_address = details.get('formatted_address', "")
            geometry = details.get('geometry', {})
            location_geo = geometry.get('location', {})
            
            new_place_data = PlaceCreate(
                canonical_name=g_name,
                google_place_id=google_place_id,
                aliases=[query] if query != g_name else [],
                address=g_address,
                latitude=location_geo.get('lat'),
                longitude=location_geo.get('lng')
            )
            return crud_place.create(db, new_place_data), True

    # 3. Google Maps 검색도 실패한 경우 레거시 생성 (좌표/주소 없음)
    legacy_place_data = PlaceCreate(
        canonical_name=query,
        aliases=[],
        address=None,
        latitude=None,
        longitude=None,
        google_place_id=None
    )
    return crud_place.create(db, legacy_place_data), True

def _heal_place_coordinates(db: Session, place: Place, query: str) -> None:
    """좌표가 누락된 기존 장소의 정보를 Google Maps에서 찾아 보충합니다."""
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

def create_or_update_from_google(db: Session, google_place_id: str, aliases: Optional[list[str]] = None) -> Place:
    """
    Google Place ID를 기반으로 장소를 생성하거나 기존 정보를 업데이트(별칭 병합)합니다.
    """
    # 1. 기존 장소 확인
    existing_place = crud_place.get_by_google_id(db, google_place_id)
    
    if existing_place:
        # 기존 별칭과 새로운 별칭 병합
        existing_aliases = json_to_aliases(existing_place.aliases)
        updated = False
        
        if aliases:
            for alias in aliases:
                if alias and alias not in existing_aliases and alias != existing_place.canonical_name:
                    existing_aliases.append(alias)
                    updated = True
        
        if updated:
            crud_place.update(db, existing_place, PlaceUpdate(aliases=existing_aliases))
        return existing_place

    # 2. 신규 생성
    details = get_place_details(google_place_id, language='ja')
    if details:
        g_name = details.get('name', "")
        g_address = details.get('formatted_address', "")
        geometry = details.get('geometry', {})
        location_geo = geometry.get('location', {})
        
        # 입력된 별칭 중 공식 명칭과 다른 것만 추출
        initial_aliases = aliases if aliases else []
        if g_name and g_name in initial_aliases:
            initial_aliases.remove(g_name)

        new_place_data = PlaceCreate(
            canonical_name=g_name,
            google_place_id=google_place_id,
            aliases=initial_aliases,
            address=g_address,
            latitude=location_geo.get('lat'),
            longitude=location_geo.get('lng')
        )
        return crud_place.create(db, new_place_data)
    
    raise Exception("Google Maps 상세 정보를 가져오는데 실패했습니다.")
