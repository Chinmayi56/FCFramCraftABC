from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---------------------------------------------------------
    # Application
    # ---------------------------------------------------------
    app_name: str = "Farm-Craft API"
    app_env: str = "development"
    app_debug: bool = True
    api_prefix: str = "/api"
    api_version: str = "1.0.0"

    # ---------------------------------------------------------
    # MongoDB
    # ---------------------------------------------------------
    mongo_url: str = "mongodb://127.0.0.1:27017"
    mongo_db_name: str = "farmcraft_db"

    # ---------------------------------------------------------
    # CORS
    # ---------------------------------------------------------
    cors_origins: str = (
        "http://localhost:5173,"
        "http://localhost:5174,"
        "http://localhost:5180"
    )

    # ---------------------------------------------------------
    # JWT Authentication
    # ---------------------------------------------------------
    jwt_secret_key: str = "insecure-dev-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440

    # ---------------------------------------------------------
    # Customer OTP
    # ---------------------------------------------------------
    otp_expire_minutes: int = 5
    otp_demo_code: str = "1234"
    otp_max_attempts: int = 5

    # ---------------------------------------------------------
    # Admin Password Reset
    # ---------------------------------------------------------
    password_reset_expire_minutes: int = 10
    password_reset_max_attempts: int = 5

    # ---------------------------------------------------------
    # SMTP / Email
    # ---------------------------------------------------------
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    # Use TLS for SMTP servers such as Gmail on port 587.
    smtp_use_tls: bool = True

    # Use SSL for SMTP servers such as port 465.
    # Keep False when using TLS on port 587.
    smtp_use_ssl: bool = False

    # ---------------------------------------------------------
    # Validators
    # ---------------------------------------------------------
    @field_validator("app_debug", mode="before")
    @classmethod
    def _parse_bool(cls, v):
        if isinstance(v, str):
            return v.strip().lower() in {
                "1",
                "true",
                "yes",
                "on",
            }
        return v

    @field_validator("smtp_use_tls", "smtp_use_ssl", mode="before")
    @classmethod
    def _parse_smtp_bool(cls, v):
        if isinstance(v, str):
            return v.strip().lower() in {
                "1",
                "true",
                "yes",
                "on",
            }
        return v

    # ---------------------------------------------------------
    # CORS helper
    # ---------------------------------------------------------
    @property
    def cors_origins_list(self) -> List[str]:
        return [
            x.strip()
            for x in self.cors_origins.split(",")
            if x.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()