from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Table, func
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

# 연결 테이블 (Event <-> Performer)
event_performers = Table(
    'event_performers',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('events.id'), primary_key=True),
    Column('performer_id', Integer, ForeignKey('performers.id'), primary_key=True)
)

class Place(Base):
    __tablename__ = "places"

    id = Column(Integer, primary_key=True, index=True)
    
    # 정규화 시스템 필드
    canonical_name = Column(String, nullable=False)  # UI 표시용 공식 이름
    normalized_name = Column(String, unique=True, index=True, nullable=False)  # 중복 체크용
    
    # 별칭 시스템 필드 (Phase 2)
    aliases = Column(Text)  # JSON 배열 문자열
    
    address = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Performer(Base):
    __tablename__ = "performers"

    id = Column(Integer, primary_key=True, index=True)
    
    # 정규화 시스템 필드
    canonical_name = Column(String, nullable=False)  # UI 표시용 공식 이름
    normalized_name = Column(String, unique=True, index=True, nullable=False)  # 중복 체크용 정규화된 이름
    
    # 별칭 시스템 필드 (Phase 2)
    aliases = Column(Text)  # JSON 배열 문자열 (SQLite 호환)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 관계 설정
    events = relationship("Event", secondary=event_performers, back_populates="performers_rel")

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    event_date = Column(String)  # YYYY-MM-DD
    door_time = Column(String)  # 개장 HH:MM
    start_time = Column(String)  # 개연 HH:MM
    end_time = Column(String)  # 종연 HH:MM
    location = Column(String)
    address = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    performers = Column(String)  # 기존 문자열 컬럼 (백업용/호환성용)
    related_link = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 추적 필드
    created_by = Column(Integer, ForeignKey('users.id'))
    updated_by = Column(Integer, ForeignKey('users.id'))
    report_count = Column(Integer, default=0)
    is_hidden = Column(Integer, default=0)  # SQLite에서는 Boolean이 Integer로 저장됨

    # 관계 설정
    performers_rel = relationship("Performer", secondary=event_performers, back_populates="events")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    profile_image = Column(String)
    google_id = Column(String, unique=True, index=True)
    flagged_event_ids = Column(Text)  # JSON 배열: "[1, 5, 10]"
    is_admin = Column(Integer, default=0)  # SQLite에서는 Boolean이 Integer로 저장됨
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), onupdate=func.now())


class EventHistory(Base):
    __tablename__ = "event_histories"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String, nullable=False)  # 'created', 'updated', 'deleted'
    
    # 변경된 데이터 스냅샷 (JSON 문자열)
    snapshot = Column(Text, nullable=False)
    
    # 변경 사항 요약 (제목, 날짜, 장소 등 주요 필드만)
    changes_summary = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    event = relationship("Event")
    user = relationship("User")


class EventReport(Base):
    __tablename__ = "event_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    reporter_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    reason = Column(String, nullable=False)  # 'spam', 'inappropriate', 'wrong_info', 'other'
    description = Column(Text)  # 상세 설명
    status = Column(String, default='pending')  # 'pending', 'reviewed', 'resolved'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    event = relationship("Event")
    reporter = relationship("User")

