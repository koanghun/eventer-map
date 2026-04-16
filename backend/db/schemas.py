from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import json


class PerformerBase(BaseModel):
    canonical_name: str
    aliases: Optional[List[str]] = []  # 배열로 받아서 저장

class PerformerCreate(PerformerBase):
    pass


class PerformerUpdate(BaseModel):
    canonical_name: Optional[str] = Field(None, min_length=1, max_length=200)
    aliases: Optional[List[str]] = None


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
        """별칭 데이터 처리 (SQLAlchemy Proxy 또는 JSON 대응)"""
        if isinstance(value, str):
            try: return json.loads(value)
            except: return []
        # AssociationProxy 등 리스트류 객체 대응
        try:
            return [v for v in value] if value and not isinstance(value, (list, str)) else (value or [])
        except:
            return value
    
    class Config:
        from_attributes = True


class PerformerDuplicateResponse(BaseModel):
    status: str  # "duplicate", "similar_found", "no_duplicate"
    exact_match: Optional[PerformerResponse] = None
    similar_matches: List[PerformerResponse] = []


class PerformerCreateResponse(BaseModel):
    status: str  # "created", "merged", "exists"
    message: str
    performer: PerformerResponse


class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    event_date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')  # YYYY-MM-DD
    door_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 개장 HH:MM
    start_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 개연 HH:MM
    end_time: Optional[str] = Field(None, pattern=r'^\d{2}:\d{2}$')  # 종연 HH:MM
    place_id: Optional[int] = None  # 연결된 장소 ID
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
    place_id: Optional[int] = None
    performer_ids: Optional[List[int]] = []
    related_link: Optional[str] = Field(None, max_length=500)

    @field_validator('door_time', 'start_time', 'end_time', mode='before')
    @classmethod
    def empty_str_to_none(cls, value):
        """빈 문자열을 None으로 변환"""
        if value == '' or value is None:
            return None
        return value



class EventResponse(EventBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    performers_list: List[PerformerResponse] = Field(default=[], alias="performers_rel", serialization_alias="performers_list")
    place: Optional["PlaceResponse"] = None  # 연결된 장소 정보
    
    # 추적 필드
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    report_count: int = 0
    is_hidden: bool = False

    class Config:
        from_attributes = True


class PlaceBase(BaseModel):
    canonical_name: str = Field(..., min_length=1, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    google_place_id: Optional[str] = None
    aliases: Optional[List[str]] = []


class PlaceCreate(PlaceBase):
    pass


class PlaceUpdate(BaseModel):
    canonical_name: Optional[str] = Field(None, min_length=1, max_length=200)
    address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    google_place_id: Optional[str] = None
    aliases: Optional[List[str]] = None


class PlaceResponse(BaseModel):
    id: int
    canonical_name: str = Field(..., min_length=1, max_length=200)
    normalized_name: str
    google_place_id: Optional[str] = None
    address: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    aliases: List[str] = []  # API는 배열로 반환

    name: Optional[str] = None  # DEPRECATED: 제거 예정, canonical_name 사용
    created_at: datetime
    
    @field_validator('aliases', mode='before')
    @classmethod
    def deserialize_aliases(cls, value):
        """별칭 데이터 처리 (SQLAlchemy Proxy 또는 JSON 대응)"""
        if isinstance(value, str):
            try: return json.loads(value)
            except: return []
        # AssociationProxy 등 리스트류 객체 대응
        try:
            return [v for v in value] if value and not isinstance(value, (list, str)) else (value or [])
        except:
            return value

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
    is_admin: bool = False  # 관리자 권한 여부
    
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


class EventDuplicateResponse(BaseModel):
    duplicates: List[dict]


class FlagActionResponse(BaseModel):
    message: str
    flagged_event_ids: List[int]
