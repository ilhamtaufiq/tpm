import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "TPM Backend"
    app_version: str = "2.3.0"
    debug: bool = True
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "tpm_db"
    db_user: str = "root"
    db_password: str = ""

    # JWT
    jwt_secret_key: str = "your-super-secret-key-change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://tpm.test,https://tpm.test,https://tpm.cianjur.space,http://localhost:8081"

    # File Upload
    upload_dir: str = "uploads"
    max_file_size: int = 5242880  # 5MB

    @property
    def base_dir(self) -> str:
        """Get absolute path to backend root directory."""
        import os
        return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    @property
    def upload_full_path(self) -> str:
        """Get absolute path to upload directory."""
        import os
        return os.path.join(self.base_dir, self.upload_dir)

    @property
    def database_url(self) -> str:
        """Construct database URL for SQLAlchemy."""
        return (
            f"mysql+mysqldb://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string to list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
