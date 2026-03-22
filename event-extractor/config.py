"""프로젝트 설정 관리 모듈.

.env 파일에서 환경 변수를 로드하고, dataclass로 타입이 명확한 설정 객체를 제공합니다.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    """불변(immutable) 설정 객체.

    Attributes:
        llm_base_url: SGLang LLM 서버의 base URL.
        llm_model: 사용할 LLM 모델 식별자.
        gmail_credentials_path: Google OAuth credentials.json 경로.
        gmail_token_path: Gmail API token.json 경로.
        filter_config_path: 메일 필터 설정(fromAndKeyword.json) 경로.
        project_root: 프로젝트 루트 디렉토리 절대 경로.
    """

    llm_base_url: str
    llm_model: str
    gmail_credentials_path: Path
    gmail_token_path: Path
    filter_config_path: Path
    backend_api_url: str = "http://localhost:8000"
    internal_service_token: str = "eventer_sync_token_2026"
    project_root: Path = field(init=False)


    def __post_init__(self) -> None:
        # frozen=True이므로 object.__setattr__ 사용
        object.__setattr__(self, "project_root", Path(__file__).resolve().parent)


def load_settings(env_path: str | Path | None = None) -> Settings:
    """환경 변수를 로드하여 Settings 객체를 생성합니다.

    Args:
        env_path: .env 파일 경로. None이면 프로젝트 루트의 .env를 사용합니다.

    Returns:
        로드된 Settings 객체.
    """
    project_root = Path(__file__).resolve().parent

    if env_path is None:
        env_path = project_root / ".env"

    load_dotenv(env_path)

    return Settings(
        llm_base_url=os.getenv("LLM_BASE_URL", "http://localhost:30000/v1"),
        llm_model=os.getenv("LLM_MODEL", "Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4"),
        gmail_credentials_path=project_root / os.getenv("GMAIL_CREDENTIALS_PATH", "credentials.json"),
        gmail_token_path=project_root / os.getenv("GMAIL_TOKEN_PATH", "token.json"),
        filter_config_path=project_root / os.getenv("FILTER_CONFIG_PATH", "fromAndKeyword.json"),
        backend_api_url=os.getenv("BACKEND_API_URL", "http://localhost:8000"),
        internal_service_token=os.getenv("INTERNAL_SERVICE_TOKEN", "eventer_sync_token_2026")
    )

