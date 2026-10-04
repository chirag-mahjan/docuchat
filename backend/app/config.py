import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "DocuChat"
    VERSION: str = "1.0.0"
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/docuchat"
    )
    SYNC_DATABASE_URL: str = os.getenv(
        "SYNC_DATABASE_URL", 
        "postgresql+psycopg2://postgres:postgrespassword@localhost:5432/docuchat"
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")
    
    # Vector dimension for all-MiniLM-L6-v2 is 384 (or 1536 for text-embedding-3-small)
    VECTOR_DIMENSION: int = 384

settings = Settings()
