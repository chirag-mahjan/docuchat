export type DocumentStatus = 'uploaded' | 'parsing' | 'chunking' | 'embedding' | 'ready' | 'failed';

export interface Document {
  id: string;
  filename: string;
  status: DocumentStatus;
  page_count: number;
  error_message?: string;
  created_at: string;
}

export interface Citation {
  index?: number;
  chunk_id: string;
  document_id: string;
  document_name?: string;
  page_number: number;
  snippet: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  document_ids: string[];
  created_at: string;
  messages?: Message[];
}

export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  difficulty: string;
  source_chunk_id?: string;
  source_snippet?: string;
  page_number: number;
}

export interface Quiz {
  id: string;
  document_id: string;
  difficulty: QuizDifficulty;
  question_count: number;
  status: 'generating' | 'ready' | 'failed';
  created_at: string;
  questions?: QuizQuestion[];
}

export interface QuestionGradeResult {
  question_id: string;
  question: string;
  user_answer: number;
  correct_answer: number;
  is_correct: boolean;
  explanation: string;
  page_number: number;
  source_chunk_id?: string;
}

export interface QuizGradeResponse {
  quiz_id: string;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
  results: QuestionGradeResult[];
}
