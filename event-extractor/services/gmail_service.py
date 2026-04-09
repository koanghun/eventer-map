"""Gmail API 서비스 모듈.

Gmail API 인증 및 메일 조회 로직을 캡슐화합니다.
"""

from __future__ import annotations

import base64
import logging
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build, Resource

from models.filter_config import FilterConfig

logger = logging.getLogger(__name__)

# Gmail 권한 (조회 및 라벨 수정)
_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
_PROCESSED_LABEL = "Event-Processed"


class GmailServiceError(Exception):
    """Gmail 서비스 관련 예외."""


class GmailService:
    """Gmail API 래퍼 서비스.

    인증, 토큰 갱신, 메일 조회를 하나의 클래스로 캡슐화합니다.

    Attributes:
        credentials_path: OAuth credentials.json 파일 경로.
        token_path: token.json 파일 경로.
    """

    def __init__(self, credentials_path: Path, token_path: Path) -> None:
        self.credentials_path = credentials_path
        self.token_path = token_path
        self._service: Resource | None = None
        self._label_cache: dict[str, str] = {}  # 라벨 이름 -> ID 캐시

    @property
    def service(self) -> Resource:
        """인증된 Gmail API 서비스 인스턴스 (lazy init)."""
        if self._service is None:
            self._service = self._authenticate()
        return self._service

    def _authenticate(self) -> Resource:
        """OAuth2 인증을 수행하고 Gmail API 서비스를 반환합니다."""
        # Credentials: 구글 서버와 통신할 때 사용하는 '로그인 증명서' 객체입니다.
        creds: Credentials | None = None

        # 1. 기존에 저장된 '열쇠(token.json)'가 있는지 확인합니다.
        if self.token_path.exists():
            # from_authorized_user_file: 파일에 저장된 JSON 데이터를 읽어 
            # Credentials 객체로 변환해주는 도우미 함수입니다.
            creds = Credentials.from_authorized_user_file(
                str(self.token_path), _SCOPES
            )

        # 2. 증명서가 없거나, 있더라도 사용할 수 없는 상태(유효하지 않음)인지 확인합니다.
        # .valid: 토큰이 존재하고 만료되지 않았으며, 필요한 권한(Scope)을 모두 가지고 있는지 체크합니다.
        if not creds or not creds.valid:
            # .expired: 단순히 시간만 만료된 것인지 확인합니다.
            # .refresh_token: 재로그인 없이 새 토큰을 받을 수 있는 '갱신용 열쇠'가 있는지 확인합니다.
            if creds and creds.expired and creds.refresh_token:
                logger.info("토큰 갱신 중...")
                # refresh(Request()): 갱신용 열쇠를 구글 서버에 보내서 
                # 새로운 Access Token(실제 API 호출용 열쇠)을 받아옵니다.
                creds.refresh(Request())
            else:
                # 3. 아예 처음이거나 갱신조차 불가능한 경우, 새로 로그인을 받아야 합니다.
                if not self.credentials_path.exists():
                    raise GmailServiceError(
                        f"credentials.json을 찾을 수 없습니다: {self.credentials_path}"
                    )
                logger.info("새 OAuth2 인증 진행 중...")
                # InstalledAppFlow: 내 컴퓨터 같은 '로컬 환경'에서 브라우저를 띄워 
                # 인증 절차를 진행해주는 클래스입니다.
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(self.credentials_path), _SCOPES
                )
                # run_local_server: 실제로 기본 브라우저를 띄우고 구글 로그인 화면을 보여줍니다.
                # 인증이 완료되면 구글이 보내주는 응답을 받기 위해 잠시 대기합니다.
                creds = flow.run_local_server(port=0)

            # 4. 새로 얻은 증명서를 다음에 또 쓸 수 있게 파일로 기록해둡니다.
            # to_json(): 증명서 정보를 다시 JSON 문자열로 바꿔줍니다.
            self.token_path.write_text(creds.to_json(), encoding="utf-8")
            logger.info("토큰 저장 완료: %s", self.token_path)

        # 5. build: 최종적으로 '구글 서비스 이름(gmail)', '버전(v1)', '증명서'를 조합하여
        # 메일 보내기/읽기 등의 기능을 수행할 수 있는 "API 클라이언트"를 만들어 반환합니다.
        return build("gmail", "v1", credentials=creds)

    @staticmethod
    def build_query(filter_config: FilterConfig) -> str:
        """FilterConfig를 Gmail API 검색 쿼리 문자열로 변환합니다.

        각 필터 규칙을 OR로 결합하며, 이미 처리된 라벨을 제외합니다.
        예: ((from:a AND ...) OR (from:b AND ...)) -label:Event-Processed

        Args:
            filter_config: 메일 필터 설정.

        Returns:
            Gmail API 검색 쿼리 문자열.
        """
        parts: list[str] = []

        for rule in filter_config.filters:
            from_clause = f"from:{rule.from_address}"
            if rule.keywords:
                keyword_clauses = " OR ".join(rule.keywords)
                parts.append(f"({from_clause} ({keyword_clauses}))")
            else:
                parts.append(f"({from_clause})")

        if not parts:
            return ""

        query = f"({' OR '.join(parts)}) -label:{_PROCESSED_LABEL}"
        logger.debug("생성된 Gmail 쿼리: %s", query)
        return query

    def _get_or_create_label(self) -> str:
        """처리 완료 라벨의 ID를 가져오거나 생성합니다."""
        if _PROCESSED_LABEL in self._label_cache:
            return self._label_cache[_PROCESSED_LABEL]

        try:
            results = (
                self.service.users()
                .labels()
                .list(userId="me", fields="labels(id,name)")
                .execute()
            )
            labels = results.get("labels", [])

            for label in labels:
                if label["name"] == _PROCESSED_LABEL:
                    self._label_cache[_PROCESSED_LABEL] = label["id"]
                    return label["id"]

            # 없으면 생성
            logger.info("새 라벨 생성 중: %s", _PROCESSED_LABEL)
            label_body = {
                "name": _PROCESSED_LABEL,
                "labelListVisibility": "labelShow",
                "messageListVisibility": "show",
            }
            new_label = (
                self.service.users()
                .labels()
                .create(userId="me", body=label_body)
                .execute()
            )
            self._label_cache[_PROCESSED_LABEL] = new_label["id"]
            return new_label["id"]

        except Exception as exc:
            raise GmailServiceError(f"라벨 관리 실패: {exc}") from exc

    def add_label_to_message(self, message_id: str) -> None:
        """메일이 성공적으로 처리되었음을 표시하기 위해 라벨을 추가합니다."""
        try:
            label_id = self._get_or_create_label()
            body = {"addLabelIds": [label_id]}
            self.service.users().messages().modify(
                userId="me", id=message_id, body=body
            ).execute()
            logger.info("메일 %s에 라벨 부착 완료 (%s)", message_id, _PROCESSED_LABEL)
        except Exception as exc:
            logger.warning("메일 %s에 라벨 부착 실패: %s", message_id, exc)

    def fetch_emails(self, query: str, max_results: int = 10) -> list[dict]:
        """Gmail에서 쿼리에 매칭되는 메일 본문과 ID를 가져옵니다.

        Returns:
            {'id': str, 'body': str} 구조의 딕셔너리 리스트.
        """
        logger.info("메일 조회 중... (쿼리: %s, 최대 %d건)", query, max_results)

        if not query:
            logger.warning("검색 쿼리가 비어있습니다.")
            return []

        try:
            results = (
                self.service.users()
                .messages()
                .list(
                    userId="me",
                    q=query,
                    maxResults=max_results,
                    fields="messages(id),nextPageToken",
                )
                .execute()
            )
        except Exception as exc:
            raise GmailServiceError(f"메일 목록 조회 실패: {exc}") from exc

        messages = results.get("messages", [])
        if not messages:
            logger.info("조건에 맞는 메일이 없습니다.")
            return []

        logger.info("%d건의 메일 발견, 배치 요청으로 본문 로드 중...", len(messages))

        email_data: list[dict] = []

        def callback(request_id: str, response: dict, exception: Exception | None) -> None:
            if exception:
                logger.warning(
                    "메일 본문 추출 실패 (request_id=%s): %s", request_id, exception
                )
                return

            body = self._parse_body_payload(response.get("payload"))
            if body:
                email_data.append({"id": response["id"], "body": body})

        batch = self.service.new_batch_http_request(callback=callback)
        for msg in messages:
            batch.add(
                self.service.users()
                .messages()
                .get(userId="me", id=msg["id"], fields="id,payload")
            )
        batch.execute()

        logger.info("총 %d건의 메일 본문 추출 완료", len(email_data))
        return email_data

    def _parse_body_payload(self, payload: dict | None) -> str | None:
        """메일 페이로드에서 본문 텍스트를 추출합니다."""
        if not payload:
            return None

        try:
            # multipart 구조 처리 (간소화된 로직)
            if "parts" in payload:
                # 첫 번째 파트가 보통 plain text인 경우가 많음
                data = payload["parts"][0]["body"].get("data")
            else:
                data = payload["body"].get("data")

            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8")
        except Exception as exc:
            logger.warning("페이로드 파싱 실패: %s", exc)

        return None

    def _extract_body(self, message_id: str) -> str | None:
        """메일 ID로 본문 텍스트를 추출합니다. (단일 요청용)"""
        try:
            msg = (
                self.service.users()
                .messages()
                .get(userId="me", id=message_id, fields="id,payload")
                .execute()
            )
            return self._parse_body_payload(msg.get("payload"))

        except Exception as exc:  # noqa: BLE001
            logger.warning("메일 본문 추출 실패 (id=%s): %s", message_id, exc)

        return None
