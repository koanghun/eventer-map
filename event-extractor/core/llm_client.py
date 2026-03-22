"""SGLang LLM 클라이언트.

SGLang 서버의 OpenAI-호환 Chat Completions API를 통해 이벤트 정보를 추출합니다.
"""

from __future__ import annotations

import json
import logging

import requests

from models.event import EventData, ExtractionResult

logger = logging.getLogger(__name__)

# LLM에게 전달할 시스템 프롬프트
_SYSTEM_PROMPT = """\
You are an event information extraction assistant.
Extract event details from the given email text and return them as a JSON object.

Rules:
1. Extract: 
   - title: Title or name of the event/concert.
     * STRICT: Exclude ticket sales/application types (e.g., "先行", "一般発売", "オフィシャル先行", "二次先行").
     * STRICT: Use the actual event/live title, NOT just the artist name if a specific title exists.
   - performers: list of artists, performers, or groups (e.g. ["YOASOBI", "Pyxis"]).
     * STRICT: Extract ONLY the performer's name. Exclude character names, roles, or titles in parentheses or appended (e.g., "伊達さゆり(澁谷かのん役)" must be extracted as "伊達さゆり").
   - event_date: Date of the event (YYYY-MM-DD format).
   - door_time: Open time for doors to enter (HH:MM format, 24-hour style if possible, or null if unknown).
   - start_time: Performance start time (HH:MM format, 24-hour style, or null if unknown).
   - location: Name of the venue or place.
   - description: Brief summary or description of the event details/rules from the email (null if none).
   - related_link: Ticket URLs, URL link in the mail (e.g. eplus.jp, Lawson ticket, official links) or null if none.
2. If there are multiple events, return them all in the "events" array.
3. If a field (other than performers list or times) cannot be determined, use "unknown".
4. Always respond with ONLY valid JSON in this exact format:

{"events": [{"title": "...", "performers": [...], "event_date": "YYYY-MM-DD", "door_time": "HH:MM", "start_time": "HH:MM", "location": "...", "description": "...", "related_link": "..."}]}

Examples of Corrected Data Formulation:
- Bad Title: "SHIGURE UI Birthday Live \\"Wishing Umbrella\\" 三次先行" -> Good Title: "SHIGURE UI Birthday Live \\"Wishing Umbrella\\""
- Bad Performer: "伊達さゆり(澁谷かのん役)" -> Good Performer: "伊達さゆり"
"""




class LLMClientError(Exception):
    """LLM 클라이언트 관련 예외."""


class LLMClient:
    """SGLang LLM 서버와 통신하는 클라이언트.

    Attributes:
        base_url: LLM 서버의 base URL (예: http://localhost:30000/v1).
        model: 사용할 모델 식별자.
        timeout: HTTP 요청 타임아웃(초).
    """

    def __init__(self, base_url: str, model: str, timeout: int = 60) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    @property
    def _endpoint(self) -> str:
        return f"{self.base_url}/chat/completions"

    def extract_event(self, email_text: str) -> ExtractionResult:
        """이메일 텍스트에서 이벤트 정보를 추출합니다.

        Args:
            email_text: 분석할 이메일 본문 텍스트.

        Returns:
            추출된 이벤트 데이터가 담긴 ExtractionResult.

        Raises:
            LLMClientError: API 호출 실패 또는 응답 파싱 실패 시.
        """
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": email_text},
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }

        try:
            logger.info("LLM 서버에 추출 요청 전송 중... (%s)", self._endpoint)
            response = requests.post(
                self._endpoint,
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except requests.ConnectionError as exc:
            raise LLMClientError(
                f"LLM 서버 연결 실패. 서버가 실행 중인지 확인하세요: {self._endpoint}"
            ) from exc
        except requests.Timeout as exc:
            raise LLMClientError(
                f"LLM 서버 응답 타임아웃 ({self.timeout}초 초과)"
            ) from exc
        except requests.HTTPError as exc:
            raise LLMClientError(
                f"LLM 서버 HTTP 에러: {response.status_code} - {response.text}"
            ) from exc

        return self._parse_response(response.json())

    def _parse_response(self, response_json: dict) -> ExtractionResult:
        """LLM 응답 JSON을 ExtractionResult로 변환합니다."""
        try:
            raw_content = response_json["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise LLMClientError(
                f"LLM 응답 구조가 예상과 다릅니다: {response_json}"
            ) from exc

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError as exc:
            raise LLMClientError(
                f"LLM 응답이 유효한 JSON이 아닙니다: {raw_content}"
            ) from exc

        # "events" 배열이 있으면 사용, 없으면 단일 객체를 리스트로 감싸기
        if "events" in parsed and isinstance(parsed["events"], list):
            events_raw = parsed["events"]
        else:
            events_raw = [parsed]

        events: list[EventData] = []
        for item in events_raw:
            try:
                events.append(EventData.model_validate(item))
            except Exception as exc:  # noqa: BLE001
                logger.warning("이벤트 파싱 실패 (건너뜀): %s — %s", item, exc)

        return ExtractionResult(events=events, raw_response=raw_content)
