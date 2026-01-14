from typing import Optional
from sqlalchemy import String, Float, DateTime, Text, ForeignKey, Table, Column, Integer, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from .database import Base
from datetime import datetime

# 연결 테이블 (Event <-> Performer)
# Table은 Core API이므로 Column을 사용해야 함 (mapped_column이 아님!)
event_performers = Table(
    'event_performers',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('events.id'), primary_key=True),
    Column('performer_id', Integer, ForeignKey('performers.id'), primary_key=True)
)

class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    
    # 정규화 시스템 필드
    canonical_name: Mapped[str] = mapped_column(String)  # UI 표시용 공식 이름
    normalized_name: Mapped[str] = mapped_column(String, unique=True, index=True)  # 중복 체크용
    
    # 별칭 시스템 필드 (Phase 2)
    aliases: Mapped[Optional[str]] = mapped_column(Text)  # JSON 배열 문자열
    
    address: Mapped[Optional[str]] = mapped_column(String)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Performer(Base):
    __tablename__ = "performers"

    id: Mapped[int] = mapped_column(primary_key=True)
    
    # 정규화 시스템 필드
    canonical_name: Mapped[str] = mapped_column(String)  # UI 표시용 공식 이름
    normalized_name: Mapped[str] = mapped_column(String, unique=True, index=True)  # 중복 체크용 정규화된 이름
    
    # 별칭 시스템 필드 (Phase 2)
    aliases: Mapped[Optional[str]] = mapped_column(Text)  # JSON 배열 문자열 (SQLite 호환)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # 관계 설정
    events: Mapped[list["Event"]] = relationship(secondary=event_performers, back_populates="performers_rel")

class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[Optional[str]] = mapped_column(String, index=True)
    description: Mapped[Optional[str]] = mapped_column(String)
    event_date: Mapped[Optional[str]] = mapped_column(String)  # YYYY-MM-DD
    door_time: Mapped[Optional[str]] = mapped_column(String)  # 개장 HH:MM
    start_time: Mapped[Optional[str]] = mapped_column(String)  # 개연 HH:MM
    end_time: Mapped[Optional[str]] = mapped_column(String)  # 종연 HH:MM
    location: Mapped[Optional[str]] = mapped_column(String)
    address: Mapped[Optional[str]] = mapped_column(String)
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    performers: Mapped[Optional[str]] = mapped_column(String)  # 기존 문자열 컬럼 (백업용/호환성용)
    related_link: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now())
    
    # 추적 필드
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'))
    updated_by: Mapped[Optional[int]] = mapped_column(ForeignKey('users.id'))
    report_count: Mapped[int] = mapped_column(default=0)
    is_hidden: Mapped[int] = mapped_column(default=0)  # SQLite에서는 Boolean이 Integer로 저장됨

    # 관계 설정
    performers_rel: Mapped[list["Performer"]] = relationship(secondary=event_performers, back_populates="events")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String)
    profile_image: Mapped[Optional[str]] = mapped_column(String)
    google_id: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True)
    flagged_event_ids: Mapped[Optional[str]] = mapped_column(Text)  # JSON 배열: "[1, 5, 10]"
    is_admin: Mapped[int] = mapped_column(default=0)  # SQLite에서는 Boolean이 Integer로 저장됨
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now())


class EventHistory(Base):
    __tablename__ = "event_histories"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey('events.id'))
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    action: Mapped[str] = mapped_column(String)  # 'created', 'updated', 'deleted'
    
    # 변경된 데이터 스냅샷 (JSON 문자열)
    snapshot: Mapped[str] = mapped_column(Text)
    
    # 변경 사항 요약 (제목, 날짜, 장소 등 주요 필드만)
    changes_summary: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    event: Mapped["Event"] = relationship()
    user: Mapped["User"] = relationship()


class EventReport(Base):
    __tablename__ = "event_reports"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey('events.id'))
    reporter_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    reason: Mapped[str] = mapped_column(String)  # 'spam', 'inappropriate', 'wrong_info', 'other'
    description: Mapped[Optional[str]] = mapped_column(Text)  # 상세 설명
    status: Mapped[str] = mapped_column(String, default='pending')  # 'pending', 'reviewed', 'resolved'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    event: Mapped["Event"] = relationship()
    reporter: Mapped["User"] = relationship()

