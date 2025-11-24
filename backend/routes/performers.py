from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas

router = APIRouter(prefix="/performers", tags=["performers"])

@router.get("/", response_model=List[schemas.PerformerResponse])
def get_performers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """모든 출연자 조회"""
    performers = db.query(models.Performer).offset(skip).limit(limit).all()
    return performers
