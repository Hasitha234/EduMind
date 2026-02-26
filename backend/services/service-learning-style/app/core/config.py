"""Configuration settings for Learning Style Service"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # App Info
    APP_NAME: str = "EduMind Learning Style Recognition Service"
    APP_VERSION: str = "1.0.0"
    
    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:admin@localhost:5432/edumind_learning_style"
    
    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    
    # CORS
    CORS_ORIGINS: list = ["*"]

    ENGAGEMENT_API_URL: str = "http://localhost:8005/api/v1"
    
    # Recommendation Settings
    MAX_RECOMMENDATIONS_PER_DAY: int = 5
    MIN_HOURS_BETWEEN_RECOMMENDATIONS: int = 2
    RECOMMENDATION_THRESHOLD: float = 0.50
    HIGH_PRIORITY_THRESHOLD: float = 0.80
    MEDIUM_PRIORITY_THRESHOLD: float = 0.65
    
    # Learning Style Settings
    MIN_DAYS_FOR_CLASSIFICATION: int = 7
    LEARNING_STYLE_UPDATE_FREQUENCY_DAYS: int = 7
    LEARNING_STYLES: list = ["Visual", "Auditory", "Reading", "Kinesthetic", "Mixed"]
    
    # Struggle Detection Settings
    QUIZ_FAILURE_HIGH_THRESHOLD: int = 40  # < 40% = High severity
    QUIZ_FAILURE_MEDIUM_THRESHOLD: int = 60  # < 60% = Medium severity
    QUIZ_FAILURE_LOW_THRESHOLD: int = 70  # < 70% = Low severity
    
    # ML Model Settings
    MODEL_PATH: str = "./ml_models"
    MODEL_VERSION: str = "1.0"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()













