"""
텍스트 정규화 유틸리티

다양한 표기를 하나의 표준 형태로 변환하여 중복 감지를 용이하게 합니다.
"""

import unicodedata
import re
import json
from typing import List, Optional


def normalize_text(text: str) -> str:
    """
    텍스트를 정규화하여 비교 가능한 형태로 변환
    
    변환 규칙:
    1. 유니코드 정규화 (NFKC) - 전각 → 반각, 호환성 문자 통일
    2. 소문자 변환 (영문)
    3. 공백 제거
    4. 특수문자 제거 (하이픈, 점, 밑줄, 쉼표 등)
    
    Args:
        text: 정규화할 텍스트
        
    Returns:
        정규화된 텍스트 문자열
        
    Examples:
        >>> normalize_text("Zepp Tokyo")
        'zepptokyo'
        >>> normalize_text("ZEPP TOKYO")
        'zepptokyo'
        >>> normalize_text("Ｚｅｐｐ　Ｔｏｋｙｏ")
        'zepptokyo'
        >>> normalize_text("ゼップ東京")
        'ぜっぷ東京'
    """
    if not text:
        return ""
    
    # 1. 유니코드 정규화 (NFKC)
    #    - 전각 문자를 반각으로 변환
    #    - 호환성 문자를 표준 형태로 통일
    text = unicodedata.normalize('NFKC', text)
    
    # 2. 가타카나 -> 히라가나 변환 (일본어 중복 매칭 강화)
    #    NFKC는 가타카나를 히라가나로 바꾸지 않아 ゼップ와 ぜっぷ가 불일치함
    converted = []
    for c in text:
        if '\u30a1' <= c <= '\u30f6':  # 가타카나 범위
            converted.append(chr(ord(c) - 96)) # 히라가나로 스위치 (0x60 차이)
        else:
            converted.append(c)
    text = "".join(converted)
    
    # 3. 소문자 변환 (영문)
    text = text.lower()
    
    # 4. 공백 제거 (모든 종류의 공백 문자)
    text = re.sub(r'\s+', '', text)
    
    # 5. 특수문자 제거
    #    - 하이픈, 점, 밑줄, 쉼표, 가운뎃점
    text = re.sub(r'[.\-_,・]', '', text)
    
    return text


def is_normalized_duplicate(text1: str, text2: str) -> bool:
    """
    두 텍스트가 정규화 후 동일한지 확인
    
    Args:
        text1: 첫 번째 텍스트
        text2: 두 번째 텍스트
        
    Returns:
        정규화 후 동일하면 True, 아니면 False
        
    Examples:
        >>> is_normalized_duplicate("Perfume", "PERFUME")
        True
        >>> is_normalized_duplicate("Zepp Tokyo", "Zepp　Tokyo")
        True
        >>> is_normalized_duplicate("Perfume", "パフューム")
        False
    """
    return normalize_text(text1) == normalize_text(text2)


def aliases_to_json(aliases: Optional[List[str]]) -> str:
    """
    별칭 리스트를 JSON 문자열로 변환 (SQLite 저장용)
    
    Args:
        aliases: 별칭 리스트
        
    Returns:
        JSON 문자열
    """
    if not aliases:
        return "[]"
    return json.dumps(aliases, ensure_ascii=False)


def json_to_aliases(json_str: Optional[str]) -> List[str]:
    """
    JSON 문자열을 별칭 리스트로 변환
    
    Args:
        json_str: JSON 문자열
        
    Returns:
        별칭 리스트
    """
    if not json_str:
        return []
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return []
