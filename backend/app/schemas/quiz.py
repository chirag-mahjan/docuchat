from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional

class QuizCreate(BaseModel):
    difficulty: str = "medium"  # easy | medium | hard | mixed
    question_count: int = 5     # e.g., 5, 10, 15

class QuizQuestionResponse(BaseModel):
    id: UUID
    question: str
    options: List[str]
    correct_option_index: int
    explanation: str
    difficulty: str
    source_chunk_id: Optional[UUID] = None
    source_snippet: Optional[str] = None
    page_number: int

    model_config = ConfigDict(from_attributes=True)

class QuizResponse(BaseModel):
    id: UUID
    document_id: UUID
    difficulty: str
    question_count: int
    status: str
    created_at: datetime
    questions: Optional[List[QuizQuestionResponse]] = []

    model_config = ConfigDict(from_attributes=True)

class QuizSubmitItem(BaseModel):
    question_id: UUID
    selected_option_index: int

class QuizSubmitRequest(BaseModel):
    answers: List[QuizSubmitItem]

class QuestionGradeResult(BaseModel):
    question_id: UUID
    question: str
    user_answer: int
    correct_answer: int
    is_correct: bool
    explanation: str
    page_number: int
    source_chunk_id: Optional[UUID] = None

class QuizGradeResponse(BaseModel):
    quiz_id: UUID
    total_questions: int
    correct_count: int
    score_percentage: float
    results: List[QuestionGradeResult]
