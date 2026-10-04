import logging
from typing import List
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    _model = None

    @classmethod
    def get_model(cls):
        if cls._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"Loading sentence-transformer model: {settings.EMBEDDING_MODEL}")
                cls._model = SentenceTransformer(settings.EMBEDDING_MODEL)
            except Exception as e:
                logger.error(f"Error loading embedding model: {e}")
                raise e
        return cls._model

    @classmethod
    def embed_text(cls, text: str) -> List[float]:
        model = cls.get_model()
        embedding = model.encode(text, convert_to_numpy=True).tolist()
        return embedding

    @classmethod
    def embed_documents(cls, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        model = cls.get_model()
        embeddings = model.encode(texts, convert_to_numpy=True, batch_size=32).tolist()
        return embeddings
