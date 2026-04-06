from sqlalchemy import select
from sqlalchemy.orm import Session
from db.database import SessionLocal
from db.models import Place

def check_places():
    db = SessionLocal()
    try:
        places = db.query(Place).all()
        for p in places:
            print(f"ID: {p.id}, Name: {p.canonical_name}, Lat: {p.latitude}, Lng: {p.longitude}, GoogleID: {p.google_place_id}")
    finally:
        db.close()

if __name__ == "__main__":
    check_places()
