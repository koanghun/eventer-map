import googlemaps
import os
from typing import Optional, Dict, Any

def get_google_maps_client():
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")

    if not api_key:
         # 실 서비스 시 에러 발생
        print("WARNING: GOOGLE_MAPS_API_KEY is not set in environment variables.")
        return None
    try:
        return googlemaps.Client(key=api_key)
    except Exception as e:
        print(f"Failed to create Google Maps client: {e}")
        return None

def get_place_details(place_id: str, language: str = 'ja') -> Optional[Dict[str, Any]]:
    """
    Google Places API에서 장소 상세 정보를 가져옵니다.
    
    Args:
        place_id: Google Place ID
        language: 응답 언어 (기기 기본 'ja')
        
    Returns:
        장소 상세 정보 딕셔너리 또는 None
    """
    client = get_google_maps_client()
    if not client:
        return None
        
    try:
        # 필요한 필드 명시 (요금 중복 청구 방지 및 응답 속도 최적화)
        fields = ['name', 'formatted_address', 'geometry', 'address_component', 'type']
        
        response = client.place(
            place_id=place_id,
            language=language,
            fields=fields
        )
        
        if response.get('status') == 'OK':
            return response.get('result')
            
    except Exception as e:
        print(f"Error fetching place details from Google Maps ({place_id}): {e}")
        
    return None
def search_place_by_text(query: str, language: str = 'ja') -> Optional[str]:
    """
    텍스트 검색(Name/Address)을 통해 Google Place ID를 찾습니다.
    
    Args:
        query: 검색할 장소 이름 또는 주소
        language: 응답 언어 (기본 'ja')
        
    Returns:
        Google Place ID (str) 또는 None
    """
    client = get_google_maps_client()
    if not client:
        return None
        
    try:
        # find_place 사용 (단일 장소 검색에 최적화)
        response = client.find_place(
            input=query,
            input_type='textquery',
            language=language,
            fields=['place_id']
        )
        
        if response.get('status') == 'OK' and response.get('candidates'):
            return response['candidates'][0].get('place_id')
            
    except Exception as e:
        print(f"Error searching place from Google Maps ({query}): {e}")
        
    return None
