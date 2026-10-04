import uuid
import logging
from sqlalchemy.orm import Session
from app.db.session import SyncSessionLocal
from app.db.models import Document, Chunk, Quiz, QuizQuestion
from app.services.parser import DocumentParser
from app.services.chunker import DocumentChunker
from app.services.embedder import EmbeddingService
from app.services.llm import LLMService

logger = logging.getLogger(__name__)

def process_document_job(document_id_str: str):
    """
    Background job to process an uploaded document:
    parsing -> chunking -> embedding -> store in pgvector
    """
    db: Session = SyncSessionLocal()
    doc_id = uuid.UUID(document_id_str)
    
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            logger.error(f"Document {document_id_str} not found in DB")
            return

        # 1. Parsing
        doc.status = "parsing"
        db.commit()

        pages = DocumentParser.parse_file(doc.file_path)
        if not pages or not any((p.get("text") or "").strip() for p in pages):
            raise ValueError("No extractable text found. The file may be empty or image-only.")

        doc.page_count = len(pages)
        db.commit()

        # 2. Chunking
        doc.status = "chunking"
        db.commit()

        chunker = DocumentChunker()
        raw_chunks = chunker.chunk_pages(pages)
        if not raw_chunks:
            raise ValueError("Document text could not be split into chunks.")

        # 3. Embedding
        doc.status = "embedding"
        db.commit()

        texts = [c["content"] for c in raw_chunks]
        embeddings = EmbeddingService.embed_documents(texts)

        # 4. Storing in Database
        for idx, (raw_c, emb) in enumerate(zip(raw_chunks, embeddings)):
            chunk_obj = Chunk(
                id=uuid.uuid4(),
                document_id=doc.id,
                content=raw_c["content"],
                page_number=raw_c["page_number"],
                chunk_index=raw_c["chunk_index"],
                embedding=emb
            )
            db.add(chunk_obj)

        doc.status = "ready"
        db.commit()
        logger.info(f"Successfully processed document {document_id_str} with {len(raw_chunks)} chunks.")

    except Exception as e:
        logger.error(f"Failed to process document {document_id_str}: {e}")
        db.rollback()
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            doc.status = "failed"
            doc.error_message = str(e)
            db.commit()
    finally:
        db.close()


def generate_quiz_job(quiz_id_str: str):
    """
    Background job to generate structured quiz questions for a document.
    """
    db: Session = SyncSessionLocal()
    quiz_id = uuid.UUID(quiz_id_str)

    try:
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            logger.error(f"Quiz {quiz_id_str} not found")
            return

        chunks = db.query(Chunk).filter(Chunk.document_id == quiz.document_id).order_by(Chunk.chunk_index).all()
        if not chunks:
            quiz.status = "failed"
            db.commit()
            logger.error(f"Quiz {quiz_id_str} failed: document has no chunks")
            return

        # Evenly sample chunks across document
        total_chunks = len(chunks)
        sample_size = min(quiz.question_count * 2, total_chunks)
        step = max(1, total_chunks // sample_size)
        sampled_chunks = [
            {
                "id": str(chunks[i].id),
                "content": chunks[i].content,
                "page_number": chunks[i].page_number
            }
            for i in range(0, total_chunks, step)[:sample_size]
        ]

        llm = LLMService()
        raw_questions = llm.generate_quiz_questions(
            sampled_chunks=sampled_chunks,
            difficulty=quiz.difficulty,
            question_count=quiz.question_count
        )

        saved = 0
        for q in raw_questions:
            if not isinstance(q, dict):
                continue
            options = q.get("options")
            if not isinstance(options, list):
                continue
            options = [str(opt).strip() for opt in options if str(opt).strip()]
            question_text = str(q.get("question") or "").strip()
            if not question_text or len(options) < 2:
                continue

            try:
                correct_idx = int(q.get("correct_option_index", 0))
            except (TypeError, ValueError):
                correct_idx = 0
            if correct_idx < 0 or correct_idx >= len(options):
                correct_idx = 0

            chunk_id = None
            if q.get("source_chunk_id"):
                try:
                    chunk_id = uuid.UUID(str(q["source_chunk_id"]))
                except Exception:
                    chunk_id = None

            try:
                page_number = int(q.get("page_number") or 1)
            except (TypeError, ValueError):
                page_number = 1

            difficulty = str(q.get("difficulty") or quiz.difficulty).lower()
            if difficulty not in ("easy", "medium", "hard"):
                difficulty = quiz.difficulty if quiz.difficulty != "mixed" else "medium"

            quiz_q = QuizQuestion(
                id=uuid.uuid4(),
                quiz_id=quiz.id,
                question=question_text,
                options=options,
                correct_option_index=correct_idx,
                explanation=str(q.get("explanation") or "See the source passage for this question."),
                difficulty=difficulty,
                source_chunk_id=chunk_id,
                page_number=max(1, page_number)
            )
            db.add(quiz_q)
            saved += 1

        if saved == 0:
            raise ValueError("Model returned no usable multiple-choice questions.")

        quiz.status = "ready"
        db.commit()
        logger.info(f"Successfully generated quiz {quiz_id_str} with {saved} questions.")

    except Exception as e:
        logger.error(f"Failed to generate quiz {quiz_id_str}: {e}")
        db.rollback()
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
        if quiz:
            quiz.status = "failed"
            db.commit()
    finally:
        db.close()
