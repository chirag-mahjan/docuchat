from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any, Dict

class Citation(BaseModel):
    chunk_id: str
    document_id: str
    document_name: Optional[str] = None
    page_number: int
    snippet: str

class MessageBase(BaseModel):
    role: str
    content: str

class MessageCreate(BaseModel):
    content: str

class MessageResponse(MessageBase):
    id: UUID
    conversation_id: UUID
    citations: Optional[List[Dict[str, Any]]] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"
    document_ids: List[UUID]

class ConversationResponse(BaseModel):
    id: UUID
    title: str
    document_ids: List[UUID]
    created_at: datetime
    messages: Optional[List[MessageResponse]] = []

    model_config = ConfigDict(from_attributes=True)
