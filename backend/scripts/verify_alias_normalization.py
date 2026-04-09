import sys
import os
import time

# 프로젝트 루트를 경로에 추가
# backend 폴더 내부에서 실행될 때와 외부에서 실행될 때를 모두 고려
sys.path.append(os.getcwd())

from db.database import SessionLocal
from crud import crud_place, crud_performer
from db.models import Place, Performer, PlaceAlias, PerformerAlias

def verify_migration():
    db = SessionLocal()
    try:
        print("--- 데이터 마이그레이션 확인 ---")
        place_count = db.query(Place).count()
        place_alias_count = db.query(PlaceAlias).count()
        print(f"Places: {place_count}, Place Aliases: {place_alias_count}")
        
        performer_count = db.query(Performer).count()
        performer_alias_count = db.query(PerformerAlias).count()
        print(f"Performers: {performer_count}, Performer Aliases: {performer_alias_count}")
        
        # 샘플 데이터 확인
        sample_place = db.query(Place).filter(Place.aliases_rel.any()).first()
        if sample_place:
            print(f"Sample Place: {sample_place.canonical_name}")
            print(f"Aliases (via proxy): {sample_place.aliases}")
            
            # 검색 속도 확인 (Index 활용)
            if sample_place.aliases:
                target_alias = sample_place.aliases[0]
                start_time = time.time()
                found_place = crud_place.search_by_alias(db, target_alias)
                end_time = time.time()
                
                if found_place:
                    print(f"Search for '{target_alias}' took {(end_time - start_time)*1000:.4f}ms")
                    print(f"Result ID: {found_place.id}, Name: {found_place.canonical_name}")
                else:
                    print(f"Search failed for '{target_alias}'")
        else:
            print("No places with aliases found to test search.")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify_migration()
