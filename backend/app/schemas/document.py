from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List

class DocumentBase(BaseModel):
    filename: str

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: UUID
    status: str
    page_count: int
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChunkResponse(BaseModel):
    id: UUID
    document_id: UUID
    content: str
    page_number: int
    chunk_index: int

    model_config = ConfigDict(from_attributes=True)
