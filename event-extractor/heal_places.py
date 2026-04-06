import logging
import requests
from config import load_settings
from services.api_client import APIClient

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

def main():
    settings = load_settings()
    api_client = APIClient(settings.backend_api_url, settings.internal_service_token)
    
    # 1. 모든 장소 목록 가져오기
    logger.info("모든 장소 목록을 가져오는 중... (%s/places/)", settings.backend_api_url)
    try:
        response = requests.get(f"{settings.backend_api_url}/places/", timeout=10)
        response.raise_for_status()
        places = response.json()
    except Exception as e:
        logger.error("장소 목록을 가져오는 데 실패했습니다: %s", e)
        return

    # 2. 좌표가 없는 장소 필터링
    missing_places = [
        p for p in places 
        if p.get("latitude") is None or p.get("longitude") is None
    ]
    
    if not missing_places:
        logger.info("좌표가 누락된 장소가 없습니다.")
        return

    logger.info("총 %d개의 장소에서 정보가 누락되었습니다. 복구를 시작합니다.", len(missing_places))

    # 3. 각 장소에 대해 resolve_place 호출 (백엔드 힐링 로직 트리거)
    success_count = 0
    for i, place in enumerate(missing_places, 1):
        name = place.get("canonical_name")
        place_id = place.get("id")
        logger.info("[%d/%d] '%s' (ID: %s) 복구 시도 중...", i, len(missing_places), name, place_id)
        
        # resolve_place는 성공 시 장소 ID를 반환하고, 백엔드에서 정보를 업데이트함
        result_id = api_client.resolve_place(name)
        
        if result_id:
            logger.info("   ✅ '%s' 복구 요청 성공 (Response ID: %s)", name, result_id)
            success_count += 1
        else:
            logger.warning("   ⚠️ '%s' 복구 요청 실패 (Google Maps에서 검색되지 않았을 수 있음)", name)

    logger.info("복구 작업 완료: %d/%d 성공", success_count, len(missing_places))

if __name__ == "__main__":
    main()
