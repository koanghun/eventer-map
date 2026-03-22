"""이벤트 데이터 스키마 정의.

LLM에서 추출한 이벤트 정보를 구조화된 타입으로 표현합니다.
"""

from __future__ import annotations

import re
from pydantic import BaseModel, Field, field_validator

class EventData(BaseModel):
    """단일 이벤트 정보.

    Attributes:
        title: 공연/이벤트 제목.
        performers: 출연진 목록.
        event_date: 공연 날짜 (YYYY-MM-DD 형식).
        door_time: 개장 시각 (HH:MM 형식, 있을 경우).
        start_time: 개연 시각 (HH:MM 형식, 있을 경우).
        location: 공연 장소.
    """

    title: str = Field(..., description="공연 이벤트 제목")
    performers: list[str] = Field(default_factory=list, description="출연진 목록 (아티스트)")
    event_date: str = Field(..., description="공연 날짜 (YYYY-MM-DD)")
    door_time: str | None = Field(None, description="개장 시각 (HH:MM)")
    start_time: str | None = Field(None, description="개연 시각 (HH:MM)")
    location: str = Field(..., description="공연 장소 (Venue 명칭)")
    description: str | None = Field(None, description="공연/이벤트 상세 설명 또는 내용 요약")
    related_link: str | None = Field(None, description="관련 링크 (예: 예매처, 공식 트위터 등 링크가 있을 경우)")

    @field_validator("performers", mode="before")
    @classmethod
    def clean_performers(cls, v):
        if isinstance(v, list):
            cleaned = []
            for name in v:
                if isinstance(name, str):
                    # 괄호 내용 삭제 (예: "이름(배역)")
                    name_cleaned = re.sub(r'\s*\(.*?\)', '', name)
                    cleaned.append(name_cleaned.strip())
                else:
                    cleaned.append(name)
            return cleaned
        return v




class ExtractionResult(BaseModel):
    """LLM 추출 결과를 담는 컨테이너.

    Attributes:
        events: 추출된 이벤트 목록.
        raw_response: LLM이 반환한 원본 JSON 문자열.
    """

    events: list[EventData] = Field(default_factory=list)
    raw_response: str = Field(default="", description="LLM 원본 응답")
