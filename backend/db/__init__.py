"""
Database package

Exports:
  - Base: SQLAlchemy declarative base
  - engine: Database engine
  - SessionLocal: Session factory
  - get_db: Database session dependency
  - models: All database models
  - schemas: All Pydantic schemas
"""
from .database import Base, engine, SessionLocal, get_db

# Import models to register them with Base.metadata
from . import models
from . import schemas

__all__ = [
    "Base",
    "engine",
    "SessionLocal",
    "get_db",
    "models",
    "schemas",
]
