from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings
from .base import Base

engine = create_engine(settings.sqlalchemy_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
def get_db():
    with SessionLocal() as db: yield db
