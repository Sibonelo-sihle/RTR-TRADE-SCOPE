from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional
from urllib.parse import quote, unquote

BACKEND_DIR = Path(__file__).resolve().parents[1]


def sqlalchemy_connection_url(raw: str) -> str:
    """Return a psycopg URL while safely encoding reserved user-info characters."""
    scheme, remainder = raw.strip().split("://", 1)
    authority, separator, suffix = remainder.rpartition("/")
    userinfo, at, hostinfo = authority.rpartition("@")
    if at and ":" in userinfo:
        username, password = userinfo.split(":", 1)
        authority = f"{quote(unquote(username), safe='')}:{quote(unquote(password), safe='')}@{hostinfo}"
    driver = "postgresql+psycopg" if scheme in {"postgres", "postgresql"} else scheme
    return f"{driver}://{authority}{separator}{suffix}"

class Settings(BaseSettings):
    database_url: str
    direct_url: Optional[str] = None
    frontend_url: str = "http://localhost:5173"
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    @property
    def sqlalchemy_url(self) -> str:
        return sqlalchemy_connection_url(self.database_url)

    @property
    def migration_url(self) -> str:
        return sqlalchemy_connection_url(self.direct_url or self.database_url)

settings = Settings()
