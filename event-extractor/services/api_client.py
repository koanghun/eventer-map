"""백엔드 API 클라이언트.

장소(Place), 출연자(Performer), 이벤트(Event)를 백엔드 API를 통해 동기화합니다.
"""

from __future__ import annotations

import logging
import requests
from typing import Optional, List

# 상위 폴더의 models 접근을 위해 (필요 시)
from models.event import EventData

logger = logging.getLogger(__name__)


class APIClientError(Exception):
    """API 클라이언트 관련 예외."""


class APIClient:
    """백엔드 API와 통신하는 클라이언트."""

    def __init__(self, base_url: str, internal_token: str, timeout: int = 30) -> None:
        self.base_url = base_url.rstrip("/")
        self.internal_token = internal_token
        self.timeout = timeout

    @property
    def _headers(self) -> dict:
        return {
            "X-Internal-Token": self.internal_token,
            "Content-Type": "application/json"
        }

    def resolve_place(self, location_str: str) -> Optional[int]:
        """장소 명칭으로 Place ID를 조회 또는 생성합니다."""
        url = f"{self.base_url}/places/resolve"
        params = {"query": location_str}
        
        try:
            logger.info("장소 해결 요청 중... (%s)", location_str)
            response = requests.post(
                url, 
                params=params, 
                headers=self._headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            return data.get("id")
        except Exception as exc:
            logger.error("❌ 장소 해결 실패 (%s): %s", location_str, exc)
            return None

    def resolve_performer(self, name: str) -> Optional[int]:
        """출연자 이름으로 Performer ID를 조회 또는 생성합니다."""
        # 1. 중복 체크
        check_url = f"{self.base_url}/performers/check-duplicate"
        try:
            res_check = requests.get(
                check_url, 
                params={"name": name}, 
                headers=self._headers,
                timeout=self.timeout
            )
            res_check.raise_for_status()
            data_check = res_check.json()
            
            if data_check["status"] == "duplicate" and data_check.get("exact_match"):
                return data_check["exact_match"]["id"]
            
        except Exception as exc:
             logger.warning("출연자 중복 체크 실패 (%s): %s", name, exc)

        # 2. 신규 생성 (중복 없거나 확인 불가 시)
        create_url = f"{self.base_url}/performers/"
        payload = {"canonical_name": name, "aliases": []}
        
        try:
            response = requests.post(
                create_url, 
                json=payload, 
                headers=self._headers,
                timeout=self.timeout
            )
            if response.status_code == 201:
                return response.json().get("id")
            elif response.status_code == 200: # 기존 병합 봇 응답 호환
                data = response.json()
                if "performer" in data:
                     return data["performer"].get("id")
            elif response.status_code == 409: # 충돌 시 기존 값 추출 시도
                 data = response.json()
                 if "detail" in data and "existing_performer" in data["detail"]:
                      return data["detail"]["existing_performer"].get("id")
                      
        except Exception as exc:
            logger.error("❌ 출연자 생성 실패 (%s): %s", name, exc)
            
        return None

    def sync_event(self, event_data: EventData, place_id: int, performer_ids: List[int]) -> bool:
        """이벤트를 백엔드에 동기화(중복 체크 후 생성)합니다."""
        url = f"{self.base_url}/events/sync"
        
        # schemas.EventCreate 규격에 맞게 매핑
        payload = {
            "title": event_data.title,
            "description": event_data.description,
            "event_date": event_data.event_date,
            "door_time": event_data.door_time,
            "start_time": event_data.start_time,
            "place_id": place_id,
            "performer_ids": performer_ids,
            "related_link": event_data.related_link
        }
        
        try:
            logger.info("이벤트 동기화 요청 중... (%s)", event_data.title)
            response = requests.post(
                url, 
                json=payload, 
                headers=self._headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            logger.info("✅ 이벤트 동기화 성공: %s", event_data.title)
            return True
        except Exception as exc:
            logger.error("❌ 이벤트 동기화 실패 (%s): %s", event_data.title, exc)
            return False
