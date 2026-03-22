"""이벤트 데이터 추출 파이프라인 엔트리 포인트.

Gmail에서 메일을 가져와 LLM으로 이벤트 정보를 추출하는 전체 흐름을 제어합니다.

Usage:
    python main.py                  # 기본 실행
    python main.py --max-emails 3   # 최대 3건만 처리
    python main.py --dry-run        # Gmail 조회만 수행 (AI 분석 건너뜀)
"""

from __future__ import annotations

import argparse
import json
import logging
import sys

from config import load_settings
from core.llm_client import LLMClient, LLMClientError
from models.filter_config import load_filters
from services.gmail_service import GmailService, GmailServiceError
from services.api_client import APIClient  # 백엔드 동기화 클라이언트


# ──────────────────────────────────────────────
# 로깅 설정
# ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    """CLI 인수를 파싱합니다."""
    parser = argparse.ArgumentParser(
        description="AI 기반 이벤트 데이터 추출 파이프라인",
    )
    parser.add_argument(
        "--max-emails",
        type=int,
        default=5,
        help="처리할 최대 메일 수 (기본값: 5)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Gmail 조회만 수행하고 AI 분석은 건너뜀",
    )
    return parser.parse_args()


def main() -> None:
    """파이프라인 메인 함수."""
    args = parse_args()

    # ── 1. 설정 로드 ──────────────────────────
    logger.info("⚙️  설정 로드 중...")
    settings = load_settings()
    logger.info("   LLM: %s (%s)", settings.llm_model, settings.llm_base_url)

    # ── 2. 필터 설정 로드 ─────────────────────
    logger.info("📋 필터 설정 로드 중... (%s)", settings.filter_config_path)
    filter_config = load_filters(settings.filter_config_path)
    logger.info("   %d개의 필터 규칙 로드됨", len(filter_config.filters))

    for rule in filter_config.filters:
        logger.info("   • %s → [%s]", rule.from_address, ", ".join(rule.keywords))

    # ── 3. Gmail에서 메일 가져오기 ────────────
    logger.info("📥 Gmail에서 메일 가져오는 중...")
    gmail = GmailService(settings.gmail_credentials_path, settings.gmail_token_path)
    query = GmailService.build_query(filter_config)
    logger.info("   검색 쿼리: %s", query)

    try:
        emails = gmail.fetch_emails(query, max_results=args.max_emails)
    except GmailServiceError as exc:
        logger.error("❌ Gmail 조회 실패: %s", exc)
        sys.exit(1)

    if not emails:
        logger.info("📭 조건에 맞는 메일이 없습니다. 종료합니다.")
        return

    logger.info("✅ %d건의 메일 수신 완료", len(emails))

    # ── 4. dry-run 모드면 여기서 종료 ─────────
    if args.dry_run:
        logger.info("🏃 드라이런 모드: 메일 내용 미리보기만 출력합니다.")
        for i, email in enumerate(emails, 1):
            print(f"\n{'='*60}")
            print(f"📧 메일 #{i} (ID: {email['id']})")
            print(f"{'='*60}")
            body = email["body"]
            print(body[:500])
            if len(body) > 500:
                print(f"\n  ... (총 {len(body)}자, 500자까지만 표시)")
        return

    # ── 5. LLM으로 이벤트 추출 및 백엔드 동기화 ──
    logger.info("🤖 AI 분석 및 백엔드 동기화 시작...")
    llm = LLMClient(settings.llm_base_url, settings.llm_model)
    api_client = APIClient(settings.backend_api_url, settings.internal_service_token)

    all_events = []
    for i, email in enumerate(emails, 1):
        logger.info("   [%d/%d] 메일 분석 중... (ID: %s)", i, len(emails), email["id"])
        try:
            result = llm.extract_event(email["body"])

            if result.events:
                all_events.extend(result.events)
                sync_success = 0
                
                for event in result.events:
                    logger.info("   ✨ 추출됨: [%s] %s | %s | %s", 
                                " | ".join(event.performers), 
                                event.title, 
                                event.event_date,
                                event.location)
                    
                    # A. 장소 해결 (Place ID 획득)
                    place_id = api_client.resolve_place(event.location)
                        
                    # B. 출연자 해결 (Performer IDs 획득)
                    performer_ids = []
                    for performer_name in event.performers:
                        p_id = api_client.resolve_performer(performer_name)
                        if p_id:
                            performer_ids.append(p_id)
                            
                    # C. 이벤트 백엔드 동기화 (중복 체크 포함)
                    if api_client.sync_event(event, place_id, performer_ids):
                        sync_success += 1
                
                # 하나 이상 동기화에 성공했거나 비즈니스 로직에 따라 라벨 처리
                if sync_success > 0:
                     gmail.add_label_to_message(email["id"])
                     logger.info("   ✅ 메일에 완료 라벨 부착 (ID: %s)", email["id"])
            else:
                logger.warning("   ⚠️ 이벤트 정보를 추출하지 못했습니다.")

        except LLMClientError as exc:
            logger.error("   ❌ AI 분석 실패: %s", exc)


    # ── 6. 결과 요약 출력 ─────────────────────
    print(f"\n{'='*60}")
    print(f"📊 추출 결과 요약 (총 {len(all_events)}건)")
    print(f"{'='*60}")

    if all_events:
        results = [event.model_dump() for event in all_events]
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print("추출된 이벤트가 없습니다.")

    logger.info("✅ 파이프라인 완료")



if __name__ == "__main__":
    main()
