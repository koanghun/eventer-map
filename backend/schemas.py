from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PerformerBase(BaseModel):
    name: str

class PerformerResponse(PerformerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    event_date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')  # YYYY-MM-DD
    door_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 개장 HH:MM
    start_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 개연 HH:MM
    end_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 종연 HH:MM
    location: str = Field(..., min_length=1, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    performers: Optional[str] = None  # 기존 문자열 필드 유지
    related_link: Optional[str] = Field(None, max_length=500)


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    event_date: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    door_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 개장
    start_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 개연
    end_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 종연
    location: Optional[str] = Field(None, min_length=1, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    performers: Optional[str] = None
    related_link: Optional[str] = Field(None, max_length=500)


class EventResponse(EventBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    performers_list: List[PerformerResponse] = []  # 관계형 데이터

    class Config:
        from_attributes = True


class PlaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str = Field(..., min_length=1, max_length=500)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class PlaceCreate(PlaceBase):
    pass


class PlaceResponse(PlaceBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
