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
    
    # 기존 호환성을 위한 필드 (향후 제거 예정)
    name = Column(String, index=True)  # deprecated: canonical_name 사용 권장
    
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
    
    # 기존 호환성을 위한 필드 (향후 제거 예정)
    name = Column(String, index=True)  # deprecated: canonical_name 사용 권장
    
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

    # 관계 설정
    performers_rel = relationship("Performer", secondary=event_performers, back_populates="events")
