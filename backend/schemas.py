from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, List
from datetime import datetime
import json


class PerformerBase(BaseModel):
    canonical_name: str
    aliases: Optional[List[str]] = []  # 배열로 받아서 JSON으로 변환

class PerformerCreate(PerformerBase):
    pass

class PerformerResponse(BaseModel):
    id: int
    canonical_name: str
    normalized_name: str
    aliases: List[str] = []  # API는 배열로 반환
    name: Optional[str] = None  # DEPRECATED: 제거 예정, canonical_name 사용
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    @field_validator('aliases', mode='before')
    @classmethod
    def deserialize_aliases(cls, value):
        """DB의 JSON 문자열을 배열로 변환"""
        if isinstance(value, str):
            try:
                return json.loads(value)
            except:
                return []
        return value if value else []
    
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
    performers: Optional[str] = None  # 기존 문자열 필드 (하위호환)
    performer_ids: Optional[List[int]] = []  # 출연자 ID 배열 (권장)
    related_link: Optional[str] = Field(None, max_length=500)
    
    @field_validator('door_time', 'start_time', 'end_time', mode='before')
    @classmethod
    def empty_str_to_none(cls, value):
        """빈 문자열을 None으로 변환"""
        if value == '' or value is None:
            return None
        return value


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
    
    # 추적 필드
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    report_count: int = 0
    is_hidden: bool = False

    class Config:
        from_attributes = True


class PlaceBase(BaseModel):
    canonical_name: str = Field(..., min_length=1, max_length=200)
    address: str = Field(..., min_length=1, max_length=500)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    aliases: Optional[List[str]] = []


class PlaceCreate(PlaceBase):
    pass


class PlaceResponse(BaseModel):
    id: int
    canonical_name: str = Field(..., min_length=1, max_length=200)
    normalized_name: str
    address: str = Field(..., min_length=1, max_length=500)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    aliases: List[str] = []  # API는 배열로 반환
    name: Optional[str] = None  # DEPRECATED: 제거 예정, canonical_name 사용
    created_at: datetime
    
    @field_validator('aliases', mode='before')
    @classmethod
    def deserialize_aliases(cls, value):
        """DB의 JSON 문자열을 배열로 변환"""
        if isinstance(value, str):
            try:
                return json.loads(value)
            except:
                return []
        return value if value else []

    class Config:
        from_attributes = True


# Authentication schemas
class UserBase(BaseModel):
    email: str
    name: Optional[str] = None
    profile_image: Optional[str] = None


class UserCreate(UserBase):
    google_id: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    flagged_event_ids: Optional[List[int]] = []
    
    @field_validator('flagged_event_ids', mode='before')
    @classmethod
    def parse_flagged_event_ids(cls, v):
        """JSON 문자열을 리스트로 파싱"""
        if v is None or v == '':
            return []
        if isinstance(v, str):
            try:
                return json.loads(v)
            except:
                return []
        return v
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Event History schemas
class EventHistoryResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    action: str  # 'created', 'updated', 'deleted'
    snapshot: dict  # JSON 파싱된 스냅샷
    changes_summary: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Event Report schemas
class EventReportCreate(BaseModel):
    reason: str  # 'spam', 'inappropriate', 'wrong_info', 'other'
    description: Optional[str] = None


class EventReportResponse(BaseModel):
    id: int
    event_id: int
    reporter_id: int
    reporter_name: Optional[str] = None
    reason: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True
