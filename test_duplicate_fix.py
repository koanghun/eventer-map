"""
중복 체크 버그 수정 테스트

이 테스트는 선택적 필드(출연자, 시간 정보)가 없을 때도
중복 체크가 정상적으로 작동하는지 확인합니다.
"""

import sys
sys.path.append('/home/developer/eventer-map/backend')

from utils.event_duplicate import calculate_event_similarity
import models

# 테스트 케이스 1: 모든 필수 정보만 있는 경우 (시간, 출연자 정보 없음)
print("=" * 60)
print("테스트 1: 필수 정보만 있는 이벤트 (시간, 출연자 없음)")
print("=" * 60)

event1 = models.Event(
    title="Rock Concert",
    event_date="2025-12-25",
    latitude=37.5665,
    longitude=126.9780,
    start_time=None,  # 시간 정보 없음
    door_time=None,
    performers_rel=[]  # 출연자 없음
)

event2 = models.Event(
    title="Rock Concert Show",
    event_date="2025-12-25",
    latitude=37.5666,  # 약 11m 거리
    longitude=126.9781,
    start_time=None,
    door_time=None,
    performers_rel=[]
)

result = calculate_event_similarity(event1, event2)
print(f"유사도: {result['similarity_score']}")
print(f"중복 여부: {result['is_duplicate']}")
print(f"추천: {result['recommendation']}")
print(f"매칭 조건:")
print(f"  - 같은 날짜: {result['matched_criteria']['same_date']}")
print(f"  - 같은 위치: {result['matched_criteria']['same_location']}")
print(f"  - 같은 시간: {result['matched_criteria']['same_time']}")
print(f"  - 거리(m): {result['matched_criteria']['distance_meters']}")
print(f"  - 시간차(분): {result['matched_criteria']['time_diff_minutes']}")
print(f"  - 출연자 유사도: {result['matched_criteria']['performer_similarity']}")
print(f"  - 제목 유사도: {result['matched_criteria']['title_similarity']}")
print()

# 테스트 케이스 2: 제목 유사도가 높고, 거리가 가까운 경우
print("=" * 60)
print("테스트 2: 제목 유사도 높음 (같은 제목, 같은 위치)")
print("=" * 60)

event3 = models.Event(
    title="밴드 공연",
    event_date="2025-12-25",
    latitude=37.5665,
    longitude=126.9780,
    start_time=None,
    door_time=None,
    performers_rel=[]
)

event4 = models.Event(
    title="밴드 공연",  # 완전히 같은 제목
    event_date="2025-12-25",
    latitude=37.5665,
    longitude=126.9780,  # 같은 위치
    start_time=None,
    door_time=None,
    performers_rel=[]
)

result2 = calculate_event_similarity(event3, event4)
print(f"유사도: {result2['similarity_score']}")
print(f"중복 여부: {result2['is_duplicate']}")
print(f"추천: {result2['recommendation']}")
print(f"매칭 조건:")
print(f"  - 같은 날짜: {result2['matched_criteria']['same_date']}")
print(f"  - 같은 위치: {result2['matched_criteria']['same_location']}")
print(f"  - 같은 시간: {result2['matched_criteria']['same_time']}")
print(f"  - 제목 유사도: {result2['matched_criteria']['title_similarity']}")
print()

# 테스트 케이스 3: 좌표 정보가 없는 경우
print("=" * 60)
print("테스트 3: 좌표 정보 없음 (distance = inf)")
print("=" * 60)

event5 = models.Event(
    title="밴드 공연",
    event_date="2025-12-25",
    latitude=None,  # 좌표 없음
    longitude=None,
    start_time=None,
    door_time=None,
    performers_rel=[]
)

event6 = models.Event(
    title="밴드 공연",
    event_date="2025-12-25",
    latitude=37.5665,  # 한쪽만 좌표 있음
    longitude=126.9780,
    start_time=None,
    door_time=None,
    performers_rel=[]
)

result3 = calculate_event_similarity(event5, event6)
print(f"유사도: {result3['similarity_score']}")
print(f"중복 여부: {result3['is_duplicate']}")  # 좌표 없으면 중복 아님
print(f"추천: {result3['recommendation']}")
print(f"매칭 조건:")
print(f"  - 같은 날짜: {result3['matched_criteria']['same_date']}")
print(f"  - 같은 위치: {result3['matched_criteria']['same_location']}")  # False여야 함
print(f"  - 거리(m): {result3['matched_criteria']['distance_meters']}")  # None이어야 함
print(f"  - 제목 유사도: {result3['matched_criteria']['title_similarity']}")
print()

print("=" * 60)
print("테스트 완료!")
print("=" * 60)
