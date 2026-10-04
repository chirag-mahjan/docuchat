import sys
import os
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.db.session import async_engine
from app.db.base import Base
from app.db.models import Document, Chunk, Conversation, Message, Quiz, QuizQuestion

@pytest.fixture(autouse=True, scope="module")
async def init_test_db():
    async with async_engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
    yield

@pytest.mark.anyio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "DocuChat"
    assert data["status"] == "online"

@pytest.mark.anyio
async def test_list_documents():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/documents")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.anyio
async def test_list_conversations():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/conversations")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
