import type { Document, Conversation, Quiz, QuizGradeResponse, Citation } from '../types';

const API_BASE = '/api/v1';

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  if (!text.trim()) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return 'Cannot reach the API on port 8000. Start the backend, then try again.';
    }
    return `${fallback} (HTTP ${res.status}).`;
  }
  try {
    const data = JSON.parse(text);
    if (typeof data?.detail === 'string') return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((item: { msg?: string }) => item.msg || String(item)).join(' ');
    }
  } catch {
    return text.slice(0, 240);
  }
  return fallback;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error('The server returned an empty response. Check that the backend on port 8000 is running.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The server returned a response that is not JSON.');
  }
}

export const api = {
  // Documents API
  async listDocuments(): Promise<Document[]> {
    const res = await fetch(`${API_BASE}/documents`);
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to fetch documents'));
    return readJson<Document[]>(res);
  },

  async getDocument(id: string): Promise<Document> {
    const res = await fetch(`${API_BASE}/documents/${id}`);
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to fetch document'));
    return readJson<Document>(res);
  },

  async uploadDocument(file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Upload failed'));
    }
    return readJson<Document>(res);
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete document');
  },

  // Conversations API
  async listConversations(): Promise<Conversation[]> {
    const res = await fetch(`${API_BASE}/conversations`);
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to fetch conversations'));
    return readJson<Conversation[]>(res);
  },

  async createConversation(documentIds: string[], title?: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_ids: documentIds, title }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to create conversation'));
    return readJson<Conversation>(res);
  },

  async getConversation(id: string): Promise<Conversation> {
    const res = await fetch(`${API_BASE}/conversations/${id}`);
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to fetch conversation'));
    return readJson<Conversation>(res);
  },

  async streamSendMessage(
    conversationId: string,
    content: string,
    onToken: (token: string) => void,
    onDone: (citations: Citation[]) => void,
    onError: (err: string) => void
  ) {
    try {
      const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedDone = false;

      if (!reader) throw new Error('Failed to get reader from response stream');

      const handleFrame = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const dataStr = line.replace('data: ', '').trim();
        if (!dataStr) return;
        const data = JSON.parse(dataStr);
        if (data.type === 'token') {
          onToken(data.content);
        } else if (data.type === 'done') {
          receivedDone = true;
          onDone(data.citations || []);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          try {
            handleFrame(line);
          } catch (e) {
            console.error('Error parsing SSE frame:', e);
          }
        }
      }

      if (buffer.trim()) {
        try {
          handleFrame(buffer.trim());
        } catch (e) {
          console.error('Error parsing trailing SSE frame:', e);
        }
      }

      if (!receivedDone) {
        onError('The answer stream ended before it finished. Please try again.');
      }
    } catch (err: any) {
      onError(err.message || 'Stream error');
    }
  },

  // Quizzes API
  async createQuiz(documentId: string, difficulty: string, questionCount: number): Promise<Quiz> {
    const res = await fetch(`${API_BASE}/documents/${documentId}/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty, question_count: questionCount }),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Failed to create quiz'));
    }
    return readJson<Quiz>(res);
  },

  async getQuiz(id: string): Promise<Quiz> {
    const res = await fetch(`${API_BASE}/quizzes/${id}`);
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to fetch quiz'));
    return readJson<Quiz>(res);
  },

  async gradeQuiz(id: string, answers: { question_id: string; selected_option_index: number }[]): Promise<QuizGradeResponse> {
    const res = await fetch(`${API_BASE}/quizzes/${id}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to grade quiz'));
    return readJson<QuizGradeResponse>(res);
  }
};
