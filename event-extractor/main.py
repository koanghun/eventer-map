"""이벤트 데이터 추출 파이프라인 엔트리 포인트.

Gmail에서 메일을 가져와 AI(LLM)로 이벤트 정보를 추출하는 전체 흐름을 제어합니다.

사용 방법 (Usage):
    python main.py                  # 기본 실행
    python main.py --max-emails 3   # 최대 3건만 처리하도록 설정
    python main.py --dry-run        # Gmail 조회만 하고 AI 분석은 건너뜀 (테스트용)
"""

from __future__ import annotations

# ── 라이브러리(Toolbox) 불러오기 ────────────────
import argparse  # 터미널 명령어 인자(예: --max-emails)를 처리하는 도구
import json      # 데이터를 JSON 형식(지도/리스트 형태)으로 다루는 도구
import logging   # 프로그램 실행 과정을 기록(Log)하는 도구
import sys       # 시스템 관련 기능(프로그램 종료 등)을 제어하는 도구

# ── 프로젝트 내부 모듈 불러오기 ────────────────
from config import load_settings                     # 설정값(.env)을 읽어오는 기능
from core.llm_client import LLMClient, LLMClientError # AI에게 분석을 요청하는 기능
from models.filter_config import load_filters         # 어떤 메일을 찾을지 필터 설정을 읽는 기능
from services.gmail_service import GmailService, GmailServiceError # Gmail 연동 기능
from services.api_client import APIClient            # 백엔드 서버와 데이터를 주고받는 기능


# ──────────────────────────────────────────────
# 1. 로깅(기록) 설정
# ──────────────────────────────────────────────
# 로그를 어떤 모양으로 출력할지 정합니다.
# %(asctime)s: 시간 | %(levelname)s: 중요도 | %(name)s: 파일명 | %(message)s: 내용
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
# 이 파일에서 사용할 기록기(Logger)를 생성합니다.
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    """터미널 실행 시 입력하는 옵션들을 해석합니다."""
    parser = argparse.ArgumentParser(
        description="AI 기반 이벤트 데이터 추출 파이프라인",
    )
    # --max-emails 옵션: 기본값 5개, 숫자로 받음
    parser.add_argument(
        "--max-emails",
        type=int,
        default=5,
        help="처리할 최대 메일 수 (기본값: 5)",
    )
    # --dry-run 옵션: 적으면 True(켜짐), 안 적으면 False(꺼짐)
    # action="store_true"는 옵션이 있으면 True, 없으면 False를 반환합니다.
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Gmail 조회만 수행하고 AI 분석은 건너뜀",
    )
    # --interactive 옵션: 저장 전 매번 물어볼지 결정
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="데이터 저장 전 사용자 확인 단계 추가",
    )
    return parser.parse_args()


def confirm_step(prompt: str) -> bool:
    """사용자에게 y/n 입력을 받아 진행 여부를 확인합니다. (입력 전까지 프로그램 일시정지)"""
    while True:
        try:
            # input(): 입력을 기다림 | .strip(): 공백 제거 | .lower(): 소문자 변환
            resp = input(f"❓ {prompt} (y/n): ").strip().lower()
            if resp in ("y", "yes"):
                return True
            if resp in ("n", "no"):
                return False
            print("   'y' 또는 'n'을 입력해주세요.")
        except EOFError: # 예상치 못한 입력 종료 시 안전하게 종료
            return False


def main() -> None:
    """파이프라인 전체 흐름을 관리하는 메인 함수."""
    args = parse_args() # 터미널 옵션 읽기

    # ── 1. 설정 로드 ──────────────────────────
    logger.info("⚙️  설정 로드 중...")
    settings = load_settings() # .env 등에서 설정값 가져오기
    logger.info("   LLM: %s (%s)", settings.llm_model, settings.llm_base_url)

    # ── 2. 필터 설정 로드 ─────────────────────
    # (어떤 보낸 이의 메일을 찾을지, 어떤 키워드가 들어있어야 하는지 설정)
    logger.info("📋 필터 설정 로드 중... (%s)", settings.filter_config_path)
    filter_config = load_filters(settings.filter_config_path)
    logger.info("   %d개의 필터 규칙 로드됨", len(filter_config.filters))

    for rule in filter_config.filters:
        logger.info("   • %s → [%s]", rule.from_address, ", ".join(rule.keywords))

    # ── 3. Gmail에서 메일 가져오기 ────────────
    logger.info("📥 Gmail에서 메일 가져오는 중...")
    gmail = GmailService(settings.gmail_credentials_path, settings.gmail_token_path)
    query = GmailService.build_query(filter_config) # 필터 조건에 맞는 검색어 생성
    logger.info("   검색 쿼리: %s", query)

    try:
        # 설정된 수만큼 메일을 가져옵니다.
        emails = gmail.fetch_emails(query, max_results=args.max_emails)
    except GmailServiceError as exc:
        logger.error("❌ Gmail 조회 실패: %s", exc)
        sys.exit(1) # 에러 발생 시 프로그램 종료

    if not emails:
        logger.info("📭 조건에 맞는 메일이 없습니다. 종료합니다.")
        return

    logger.info("✅ %d건의 메일 수신 완료", len(emails))

    # ── 4. dry-run 모드(스킵 모드) 체크 ─────────
    if args.dry_run:
        logger.info("🏃 드라이런 모드: 메일 내용 미리보기만 출력합니다.")
        for i, email in enumerate(emails, 1):
            print(f"\n{'='*60}")
            print(f"📧 메일 #{i} (ID: {email['id']})")
            print(f"{'='*60}")
            body = email["body"]
            print(body[:1000]) # 본문 앞 1000자만 출력
            if len(body) > 1000:
                print(f"\n  ... (총 {len(body)}자, 1000자까지만 표시)")
        return

    # ── 5. AI로 이벤트 추출 및 백엔드 서버에 저장 ──
    logger.info("🤖 AI 분석 및 백엔드 동기화 시작...")
    llm = LLMClient(settings.llm_base_url, settings.llm_model) # AI 클라이언트 준비
    api_client = APIClient(settings.backend_api_url, settings.internal_service_token) # 서버 클라이언트 준비

    all_events = []
    for i, email in enumerate(emails, 1):
        logger.info("   [%d/%d] 메일 분석 중... (ID: %s)", i, len(emails), email["id"])
        try:
            # AI에게 메일 본문을 주고 이벤트 정보를 찾아달라고 합니다.
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
                    
                    # A. 장소 확인 (서버에 해당 장소가 있는지 체크)
                    if args.interactive:
                        if not confirm_step(f"장소를 확인하시겠습니까? ({event.location})"):
                            logger.info("   ⏭️ 장소 해결 건너뜀")
                            continue
                    
                    place_id = api_client.resolve_place(event.location)
                    if not place_id:
                        logger.warning("   ⚠️ 장소를 해결하지 못해 이벤트를 건너뜁니다.")
                        continue
                        
                    # B. 출연자(가수/배우 등) 확인
                    performer_ids = []
                    for performer_name in event.performers:
                        if args.interactive:
                            if not confirm_step(f"출연자를 등록/확인하시겠습니까? ({performer_name})"):
                                logger.info("   ⏭️ 출연자 ({performer_name}) 건너뜀")
                                continue
                        
                        p_id = api_client.resolve_performer(performer_name)
                        if p_id:
                            performer_ids.append(p_id)
                            
                    # C. 최종적으로 서버에 이벤트 정보 저장
                    if args.interactive:
                        print(f"\n   [최종 검토] 이벤트: {event.title}")
                        print(f"   📅 날짜: {event.event_date} | 📍 장소 ID: {place_id}")
                        print(f"   👥 출연자 ID 목록: {performer_ids}")
                        if not confirm_step("이 이벤트를 백엔드에 동기화하시겠습니까?"):
                            logger.info("   ⏭️ 이벤트 동기화 건너뜀")
                            continue

                    if api_client.sync_event(event, place_id, performer_ids):
                        sync_success += 1
                
                # 저장에 최소 하나 이상 성공했다면 메일에 '처리 완료' 라벨을 붙입니다.
                if sync_success > 0:
                     gmail.add_label_to_message(email["id"])
                     logger.info("   ✅ 저장 완료: 메일에 라벨 부착 (ID: %s)", email["id"])
                else:
                     logger.warning("   ❌ 추출된 이벤트가 있으나 동기화에 모두 실패했습니다. (ID: %s)", email["id"])
            else:
                # AI 분석 결과 추출할 이벤트가 없는 경우에도 처리 완료로 간주하여 라벨을 붙입니다.
                # 이렇게 해야 다음 실행 시 이 메일을 다시 분석하지 않습니다.
                logger.info("   ℹ️ 추출된 이벤트 없음: 처리 완료 라벨 부착 (ID: %s)", email["id"])
                gmail.add_label_to_message(email["id"])

        except LLMClientError as exc: # AI 분석 중 에러가 나면 기록만 남기고 다음 메일로 넘어감
            logger.error("   ❌ AI 분석 실패: %s", exc)


    # ── 6. 결과 요약 출력 ─────────────────────
    print(f"\n{'='*60}")
    print(f"📊 추출 결과 요약 (총 {len(all_events)}건)")
    print(f"{'='*60}")

    if all_events:
        # 추출된 데이터들을 예쁘게 출력합니다.
        results = [event.model_dump() for event in all_events]
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print("추출된 이벤트가 없습니다.")

    logger.info("✅ 파이프라인 완료")



# 💎 프로그램의 시작점 💎
# __name__ == "__main__"은 이 파일이 직접 실행되었을 때만 main() 함수를 호출하도록 하는 안전장치입니다.
# 파이썬 인터프리터가 프로그램을 실행할 때 자동으로 부여하는 변수인 __name__을 확인합니다.
if __name__ == "__main__":
    main()
