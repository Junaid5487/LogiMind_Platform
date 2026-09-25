import os
from pydantic_settings import BaseSettings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "logimind.db").replace("\\", "/")

class Settings(BaseSettings):
    PROJECT_NAME: str = "LogiMind Enterprise AI Logistics Platform"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "logimind_super_secret_jwt_key_2026_capstone_secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours
    
    # Absolute SQLite database path
    DATABASE_URL: str = f"sqlite:///{DB_PATH}"
    
    BACKEND_CORS_ORIGINS: list = ["http://localhost:5173", "http://127.0.0.1:5173"]

    class Config:
        case_sensitive = True

settings = Settings()
