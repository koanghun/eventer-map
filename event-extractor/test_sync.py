import logging
import sys
from services.api_client import APIClient
from models.event import EventData

logging.basicConfig(level=logging.INFO)

def test():
    # 설정값 (config.py 기본값과 일치)
    backend_url = "http://localhost:8000"
    token = "eventer_sync_token_2026"
    
    api = APIClient(backend_url, token)
    
    print("\n--- 1. 장소 해결 테스트 ---")
    place_id = api.resolve_place("히ューリックホール東京") 
    print(f"결과 Place ID: {place_id}")
    
    if not place_id:
         print("장소 해결 실패로 테스트 중단")
         return

    print("\n--- 2. 출연자 해결 테스트 ---")
    performer_ids = []
    for performer in ["愛美", "はるか"]:
        p_id = api.resolve_performer(performer)
        print(f"결과 Performer ID ({performer}): {p_id}")
        if p_id:
            performer_ids.append(p_id)

    print("\n--- 3. 이벤트 동기화 테스트 ---")
    event_data = EventData(
        title="[테스트] AI 추출 이벤트 동기화",
        performers=["愛美", "はるか"],
        event_date="2026-12-25",
        door_time="18:00",
        start_time="19:00",
        location="ヒューリックホール東京",
        description="테스트용 추출 이벤트 설명입니다.",
        related_link="http://example.com/test-concert"
    )
    
    success = api.sync_event(event_data, place_id, performer_ids)
    print(f"\n✅ 동기화 결과: {'성공' if success else '실패'}")

if __name__ == "__main__":
    test()
