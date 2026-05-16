from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./spendwise.db"
    SECRET_KEY: str = "spendwise_super_secret_2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    class Config:
        env_file = ".env"

settings = Settings()