"""메일 필터 설정 스키마 정의.

fromAndKeyword.json 파일의 구조를 Pydantic 모델로 정의하고, 로드 유틸리티를 제공합니다.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field


class FilterRule(BaseModel):
    """단일 메일 필터 규칙.

    Attributes:
        from_address: 발신자 이메일 주소.
        keywords: 메일 본문/제목에서 매칭할 키워드 목록.
    """

    from_address: str = Field(..., alias="from", description="발신자 이메일 주소")
    keywords: list[str] = Field(default_factory=list, description="매칭 키워드 목록")

    model_config = {"populate_by_name": True}


class FilterConfig(BaseModel):
    """메일 필터 설정 전체.

    Attributes:
        filters: 필터 규칙 목록.
    """

    filters: list[FilterRule] = Field(default_factory=list)


def load_filters(path: str | Path) -> FilterConfig:
    """JSON 파일에서 필터 설정을 로드합니다.

    Args:
        path: fromAndKeyword.json 파일 경로.

    Returns:
        파싱된 FilterConfig 객체.

    Raises:
        FileNotFoundError: 파일이 존재하지 않을 때.
        json.JSONDecodeError: JSON 파싱 실패 시.
        pydantic.ValidationError: 스키마 불일치 시.
    """
    file_path = Path(path)

    if not file_path.exists():
        raise FileNotFoundError(f"필터 설정 파일을 찾을 수 없습니다: {file_path}")

    raw = json.loads(file_path.read_text(encoding="utf-8"))
    return FilterConfig.model_validate(raw)
