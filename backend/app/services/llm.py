import json
import logging
from typing import AsyncGenerator, List, Dict, Any, Optional
from groq import Groq
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

def _extract_question_list(data: Any) -> List[Dict[str, Any]]:
    """Pull a list of question objects out of a raw JSON array or wrapper object."""
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("questions", "quiz", "items", "data"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        for value in data.values():
            if isinstance(value, list) and any(isinstance(item, dict) for item in value):
                return [item for item in value if isinstance(item, dict)]
    return []

class LLMService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        if settings.GROQ_API_KEY and settings.GROQ_API_KEY != "gsk_placeholder_replace_me":
            self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
        else:
            self.groq_client = None

        if settings.OPENAI_API_KEY:
            self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        else:
            self.openai_client = None

    def _get_client(self):
        if self.provider == "groq" and self.groq_client:
            return self.groq_client, "openai/gpt-oss-20b"
        elif self.openai_client:
            return self.openai_client, "gpt-4o-mini"
        elif self.groq_client:
            return self.groq_client, "openai/gpt-oss-20b"
        else:
            return None, None

    def stream_answer(
        self, 
        query: str, 
        context_chunks: List[Dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        """
        Builds grounded RAG prompt and yields SSE streaming response tokens.
        context_chunks: [{"index": int, "content": str, "doc_name": str, "page_number": int}]
        """
        client, model_name = self._get_client()

        if not client:
            yield "Data: [ERROR] No valid LLM API key configured (GROQ_API_KEY or OPENAI_API_KEY).\n\n"
            return

        context_text = ""
        for chunk in context_chunks:
            context_text += f"[{chunk['index']}] {chunk['content']} (Source Document: {chunk['doc_name']}, Page: {chunk['page_number']})\n\n"

        system_prompt = (
            "You are a helpful assistant grounded strictly in the provided document context.\n"
            "Answer ONLY using the context below. If the answer isn't in the context, say "
            "\"I don't have enough information in these documents to answer that question.\"\n"
            "Cite the context chunks you use with ASCII markers like [1] and [2]. Do not use fullwidth brackets."
        )

        user_prompt = f"Context:\n{context_text}\nQuestion: {query}"

        try:
            if isinstance(client, Groq):
                stream = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    stream=True,
                    temperature=0.2
                )
                for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
            else:
                stream = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    stream=True,
                    temperature=0.2
                )
                for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
        except Exception as e:
            logger.error(f"Error streaming LLM response: {e}")
            yield f"\n[Error generating answer: {str(e)}]"

    def generate_quiz_questions(
        self, 
        sampled_chunks: List[Dict[str, Any]], 
        difficulty: str = "medium", 
        question_count: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Generates structured JSON multiple choice questions across sampled document chunks.
        difficulty: easy | medium | hard | mixed
        """
        client, model_name = self._get_client()
        if not client:
            raise ValueError("No valid LLM API key configured (GROQ_API_KEY or OPENAI_API_KEY).")

        chunk_texts = ""
        for idx, chunk in enumerate(sampled_chunks):
            chunk_texts += f"CHUNK_ID: {chunk['id']}\nPAGE: {chunk['page_number']}\nTEXT: {chunk['content']}\n\n"

        difficulty_guide = {
            "easy": "Questions should be direct fact-recall answerable from a single explicit sentence in the chunk.",
            "medium": "Questions should require combining information or light inference across the chunk.",
            "hard": "Questions should be deep conceptual questions requiring analysis, synthesis, or nuanced understanding.",
            "mixed": "Mix easy, medium, and hard difficulty questions appropriately."
        }

        prompt = f"""You are an expert educational quiz creator. Generate exactly {question_count} multiple-choice questions from the following document chunks.

Difficulty Level: {difficulty.upper()}
Criteria: {difficulty_guide.get(difficulty, difficulty_guide['medium'])}

Return ONLY a JSON object, with NO markdown formatting, matching this exact schema:
{{
  "questions": [
    {{
      "question": "Clear, concise question statement",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_option_index": 0,
      "explanation": "Detailed explanation of why this answer is correct citing facts from the source",
      "difficulty": "{difficulty if difficulty != 'mixed' else 'easy|medium|hard'}",
      "source_chunk_id": "UUID from CHUNK_ID above",
      "page_number": 1
    }}
  ]
}}

Document Chunks:
{chunk_texts}
"""

        try:
            if isinstance(client, Groq):
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.3
                )
            else:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.3
                )

            raw_content = (response.choices[0].message.content or "").strip()
            if raw_content.startswith("```"):
                raw_content = raw_content.split("\n", 1)[-1]
                if raw_content.endswith("```"):
                    raw_content = raw_content[: raw_content.rfind("```")].strip()
            
            data = json.loads(raw_content)
            questions = _extract_question_list(data)
            if not questions:
                raise ValueError("Quiz model response did not contain a list of questions.")
            return questions

        except Exception as e:
            logger.error(f"Error generating quiz questions: {e}")
            raise e
