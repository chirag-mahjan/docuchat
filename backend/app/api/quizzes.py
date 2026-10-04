import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models import Quiz, QuizQuestion, Document, Chunk
from app.schemas.quiz import (
    QuizCreate, QuizResponse, QuizSubmitRequest, QuizGradeResponse, QuestionGradeResult
)
from app.worker.queue import enqueue_quiz_generation

router = APIRouter(tags=["Quizzes"])

@router.post("/documents/{document_id}/quizzes", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def create_quiz(
    document_id: uuid.UUID,
    payload: QuizCreate,
    db: AsyncSession = Depends(get_db)
):
    # Verify document exists and is ready
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if doc.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is not ready for quiz generation (current status: '{doc.status}')."
        )

    quiz = Quiz(
        id=uuid.uuid4(),
        document_id=doc.id,
        difficulty=payload.difficulty,
        question_count=payload.question_count,
        status="generating"
    )
    db.add(quiz)
    await db.commit()

    # Trigger background quiz generation
    enqueue_quiz_generation(str(quiz.id))

    # Load questions here. Serializing the relationship later lazy-loads it
    # outside the async session and the create request returns 500.
    loaded = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == quiz.id)
    )
    return loaded.scalar_one()


@router.get("/quizzes/{id}", response_model=QuizResponse)
async def get_quiz(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == id)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    quiz.questions.sort(key=lambda q: (q.page_number or 0, str(q.id)))
    chunk_ids = [q.source_chunk_id for q in quiz.questions if q.source_chunk_id]
    snippets = {}
    if chunk_ids:
        chunk_rows = await db.execute(select(Chunk).where(Chunk.id.in_(chunk_ids)))
        snippets = {chunk.id: chunk.content for chunk in chunk_rows.scalars().all()}
    for question in quiz.questions:
        question.source_snippet = snippets.get(question.source_chunk_id)

    return quiz


@router.post("/quizzes/{id}/grade", response_model=QuizGradeResponse)
async def grade_quiz(
    id: uuid.UUID,
    payload: QuizSubmitRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.id == id)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found")

    questions_map = {str(q.id): q for q in quiz.questions}
    results: List[QuestionGradeResult] = []
    correct_count = 0

    for item in payload.answers:
        q_id_str = str(item.question_id)
        if q_id_str in questions_map:
            q = questions_map[q_id_str]
            is_correct = (item.selected_option_index == q.correct_option_index)
            if is_correct:
                correct_count += 1

            results.append(
                QuestionGradeResult(
                    question_id=q.id,
                    question=q.question,
                    user_answer=item.selected_option_index,
                    correct_answer=q.correct_option_index,
                    is_correct=is_correct,
                    explanation=q.explanation,
                    page_number=q.page_number,
                    source_chunk_id=q.source_chunk_id
                )
            )

    total = len(quiz.questions)
    percentage = round((correct_count / total) * 100, 1) if total > 0 else 0.0

    return QuizGradeResponse(
        quiz_id=quiz.id,
        total_questions=total,
        correct_count=correct_count,
        score_percentage=percentage,
        results=results
    )
