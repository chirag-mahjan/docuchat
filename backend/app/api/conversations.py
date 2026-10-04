import uuid
import json
import re
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, text
from sqlalchemy.orm import selectinload

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import Conversation, Message, Chunk, Document
from app.schemas.conversation import (
    ConversationCreate, ConversationResponse, MessageCreate, MessageResponse
)
from app.services.embedder import EmbeddingService
from app.services.llm import LLMService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["Conversations"])

@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate,
    db: AsyncSession = Depends(get_db)
):
    doc_id_strs = [str(d) for d in payload.document_ids]
    conv = Conversation(
        id=uuid.uuid4(),
        title=payload.title or "New Conversation",
        document_ids=doc_id_strs
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)

    # Re-fetch with messages
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conv.id)
    )
    return result.scalar_one()


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .order_by(Conversation.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{id}", response_model=ConversationResponse)
async def get_conversation(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


@router.post("/{id}/messages")
async def send_message(
    id: uuid.UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db)
):
    # Fetch conversation
    result = await db.execute(
        select(Conversation).where(Conversation.id == id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    user_query = payload.content.strip()

    # Save user message
    user_msg = Message(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        role="user",
        content=user_query,
        citations=[]
    )
    db.add(user_msg)
    await db.commit()

    # 1. Embed query
    query_vector = EmbeddingService.embed_text(user_query)

    # 2. Vector search with pgvector (cosine distance)
    # Convert doc UUID strings to UUID list for filtering
    target_doc_ids = [uuid.UUID(d) for d in conv.document_ids] if conv.document_ids else []

    if target_doc_ids:
        query_stmt = (
            select(Chunk, Chunk.embedding.cosine_distance(query_vector).label("distance"))
            .where(Chunk.document_id.in_(target_doc_ids))
            .order_by(text("distance ASC"))
            .limit(6)
        )
    else:
        query_stmt = (
            select(Chunk, Chunk.embedding.cosine_distance(query_vector).label("distance"))
            .order_by(text("distance ASC"))
            .limit(6)
        )

    res = await db.execute(query_stmt)
    results = res.all()

    # Short questions like "what is the email?" embed far from a resume that
    # only prints the address, so a strict distance cutoff drops the only page
    # that contains the answer. Scoped documents are read in full when they are
    # small; larger ones keep the closest passages and let the model refuse.
    if target_doc_ids:
        count_result = await db.execute(
            select(func.count()).select_from(Chunk).where(Chunk.document_id.in_(target_doc_ids))
        )
        chunk_count = count_result.scalar() or 0
        if 0 < chunk_count <= 8:
            scoped = await db.execute(
                select(Chunk)
                .where(Chunk.document_id.in_(target_doc_ids))
                .order_by(Chunk.chunk_index)
            )
            valid_results = [(chunk, 0.0) for chunk in scoped.scalars().all()]
        else:
            valid_results = list(results)
    else:
        valid_results = [(chunk, dist) for chunk, dist in results if dist < 0.75]

    # Fetch document names
    doc_names = {}
    if valid_results:
        unique_doc_ids = list(set(chunk.document_id for chunk, _ in valid_results))
        doc_res = await db.execute(select(Document).where(Document.id.in_(unique_doc_ids)))
        for doc in doc_res.scalars().all():
            doc_names[str(doc.id)] = doc.filename

    context_chunks = []
    chunk_map = {}
    for idx, (chunk, dist) in enumerate(valid_results, start=1):
        c_dict = {
            "index": idx,
            "chunk_id": str(chunk.id),
            "document_id": str(chunk.document_id),
            "doc_name": doc_names.get(str(chunk.document_id), "Document"),
            "page_number": chunk.page_number,
            "snippet": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
            "content": chunk.content
        }
        context_chunks.append(c_dict)
        chunk_map[idx] = c_dict

    # SSE Streaming response setup
    async def sse_event_generator():
        llm_service = LLMService()
        full_response_text = ""

        if not valid_results:
            fallback = "I don't have enough information in these documents to answer that question."
            yield f"data: {json.dumps({'type': 'token', 'content': fallback})}\n\n"
            full_response_text = fallback
        else:
            for token in llm_service.stream_answer(user_query, context_chunks):
                full_response_text += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        # Keep citation N aligned with the [N] marker in the answer.
        # A set walks in appearance order, so [2] then [1] used to open the wrong passage.
        cited_indices = sorted({int(n) for n in re.findall(r"[\[【](\d+)[\]】]", full_response_text)})
        matched_citations = []
        for idx in cited_indices:
            if idx in chunk_map:
                c = chunk_map[idx]
                matched_citations.append({
                    "index": idx,
                    "chunk_id": c["chunk_id"],
                    "document_id": c["document_id"],
                    "document_name": c["doc_name"],
                    "page_number": c["page_number"],
                    "snippet": c["content"],
                })

        # Persist on a fresh session. get_db() is a FastAPI dependency generator,
        # not a context manager — using it here aborted the stream before "done".
        try:
            async with AsyncSessionLocal() as new_db:
                asst_msg = Message(
                    id=uuid.uuid4(),
                    conversation_id=conv.id,
                    role="assistant",
                    content=full_response_text,
                    citations=matched_citations
                )
                new_db.add(asst_msg)
                await new_db.commit()
        except Exception:
            logger.exception("Failed to persist assistant message for conversation %s", conv.id)

        yield f"data: {json.dumps({'type': 'done', 'citations': matched_citations})}\n\n"

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")
