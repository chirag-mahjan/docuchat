import React, { useState } from 'react';
import type { Document, QuizDifficulty } from '../types';
import { X, Sparkles, Loader2, BookOpen } from 'lucide-react';

interface QuizModalProps {
  document: Document | null;
  onClose: () => void;
  onGenerate: (documentId: string, difficulty: QuizDifficulty, questionCount: number) => void;
  isGenerating: boolean;
}

export const QuizModal: React.FC<QuizModalProps> = ({ document, onClose, onGenerate, isGenerating }) => {
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);

  if (!document) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(document.id, difficulty, questionCount);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '480px', maxWidth: '100%', padding: '1.5rem', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X style={{ width: '20px', height: '20px' }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles style={{ color: '#fff', width: '22px', height: '22px' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Generate MCQ Quiz</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-generate multiple choice questions from document content</p>
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen style={{ width: '16px', height: '16px', color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{document.filename}</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Difficulty Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
              Difficulty Level
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {([
                { level: 'easy', hint: 'Fact recall' },
                { level: 'medium', hint: 'Light inference' },
                { level: 'hard', hint: 'Deep analysis' },
                { level: 'mixed', hint: 'Balanced set' },
              ] as { level: QuizDifficulty; hint: string }[]).map(({ level, hint }) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '8px',
                    border: `1.5px solid ${difficulty === level ? '#10b981' : 'var(--border-color)'}`,
                    background: difficulty === level ? 'rgba(16, 185, 129, 0.2)' : 'rgba(22, 30, 46, 0.5)',
                    color: difficulty === level ? '#34d399' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'capitalize' }}>{level}</span>
                  <span style={{ fontSize: '0.62rem', opacity: 0.85 }}>{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Question Count Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
              Number of Questions
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[3, 5, 10, 15].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    border: `1px solid ${questionCount === count ? '#10b981' : 'var(--border-color)'}`,
                    background: questionCount === count ? 'rgba(16, 185, 129, 0.2)' : 'rgba(22, 30, 46, 0.5)',
                    color: questionCount === count ? '#34d399' : 'var(--text-muted)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {count} Questions
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            style={{
              marginTop: '0.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '12px',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" style={{ width: '18px', height: '18px' }} />
                Generating Quiz...
              </>
            ) : (
              <>
                <Sparkles style={{ width: '18px', height: '18px' }} />
                Generate {questionCount} {difficulty} MCQ Questions
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
