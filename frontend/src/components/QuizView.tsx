import React, { useState } from 'react';
import type { Quiz, QuizGradeResponse, Citation } from '../types';
import { Sparkles, CheckCircle2, XCircle, Award, RotateCcw, FileText, ArrowRight, ArrowLeft } from 'lucide-react';

interface QuizViewProps {
  quiz: Quiz;
  onGradeQuiz: (answers: { question_id: string; selected_option_index: number }[]) => Promise<QuizGradeResponse>;
  onCitationClick: (citation: Citation) => void;
  onResetQuiz: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ quiz, onGradeQuiz, onCitationClick, onResetQuiz }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [gradeResult, setGradeResult] = useState<QuizGradeResponse | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const questions = quiz.questions || [];
  const currentQuestion = questions[currentIdx];
  const answeredCount = questions.filter((question) => selectedAnswers[question.id] !== undefined).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (gradeResult) return; // Locked once submitted
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleSubmit = async () => {
    const formatted = Object.entries(selectedAnswers).map(([qId, optIdx]) => ({
      question_id: qId,
      selected_option_index: optIdx
    }));

    setIsGrading(true);
    try {
      const res = await onGradeQuiz(formatted);
      setGradeResult(res);
    } catch (err) {
      console.error('Failed to grade quiz:', err);
    } finally {
      setIsGrading(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div style={{ flex: 1, padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No questions generated yet for this quiz.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%', padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '720px' }}>
        {/* Header summary */}
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              MCQ Quiz Mode ({quiz.difficulty} difficulty)
            </span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px' }}>Document Knowledge Check</h2>
          </div>
          <button
            onClick={onResetQuiz}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            <RotateCcw style={{ width: '14px', height: '14px' }} /> Reset
          </button>
        </div>

        {/* Score Banner (Post-submission) */}
        {gradeResult && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)', border: '1px solid rgba(16, 185, 129, 0.4)', textAlign: 'center' }}>
            <Award style={{ width: '42px', height: '42px', color: '#34d399', margin: '0 auto 0.5rem auto' }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
              Your Score: {gradeResult.score_percentage}%
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
              You answered <strong>{gradeResult.correct_count}</strong> out of <strong>{gradeResult.total_questions}</strong> questions correctly!
            </p>
          </div>
        )}

        {/* Question Stepper */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {questions.map((q, idx) => {
            const isAnswered = selectedAnswers[q.id] !== undefined;
            const res = gradeResult?.results.find(r => r.question_id === q.id);
            let bg = 'rgba(22, 30, 46, 0.6)';
            let border = 'var(--border-color)';
            if (res) {
              bg = res.is_correct ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
              border = res.is_correct ? '#34d399' : '#f87171';
            } else if (idx === currentIdx) {
              border = 'var(--accent-primary)';
              bg = 'rgba(99, 102, 241, 0.2)';
            } else if (isAnswered) {
              bg = 'rgba(255, 255, 255, 0.1)';
            }

            return (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(idx)}
                style={{
                  flex: 1,
                  minWidth: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: `1px solid ${border}`,
                  background: bg,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Question Card */}
        {currentQuestion && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '10px', textTransform: 'capitalize' }}>
                Page {currentQuestion.page_number}
              </span>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: '1.5', marginBottom: '1.25rem' }}>
              {currentQuestion.question}
            </h3>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {currentQuestion.options.map((opt, optIdx) => {
                const isSelected = selectedAnswers[currentQuestion.id] === optIdx;
                const result = gradeResult?.results.find(r => r.question_id === currentQuestion.id);
                let optionBg = 'rgba(15, 23, 42, 0.6)';
                let optionBorder = 'var(--border-color)';
                let icon = null;

                if (result) {
                  if (optIdx === result.correct_answer) {
                    optionBg = 'rgba(16, 185, 129, 0.2)';
                    optionBorder = '#34d399';
                    icon = <CheckCircle2 style={{ width: '18px', height: '18px', color: '#34d399' }} />;
                  } else if (isSelected && !result.is_correct) {
                    optionBg = 'rgba(239, 68, 68, 0.2)';
                    optionBorder = '#f87171';
                    icon = <XCircle style={{ width: '18px', height: '18px', color: '#f87171' }} />;
                  }
                } else if (isSelected) {
                  optionBg = 'rgba(99, 102, 241, 0.25)';
                  optionBorder = 'var(--accent-primary)';
                }

                return (
                  <div
                    key={optIdx}
                    onClick={() => handleSelectOption(currentQuestion.id, optIdx)}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: `1px solid ${optionBorder}`,
                      background: optionBg,
                      cursor: gradeResult ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 500 }}>{opt}</span>
                    </div>
                    {icon}
                  </div>
                );
              })}
            </div>

            {/* Explanation & Source Citation */}
            {gradeResult && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399', marginBottom: '0.4rem' }}>Explanation & Grounding:</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {currentQuestion.explanation}
                </p>

                {(currentQuestion.source_chunk_id || currentQuestion.source_snippet) && (
                  <button
                    onClick={() => onCitationClick({
                      chunk_id: currentQuestion.source_chunk_id || currentQuestion.id,
                      document_id: quiz.document_id,
                      page_number: currentQuestion.page_number,
                      snippet: currentQuestion.source_snippet || currentQuestion.explanation
                    })}
                    style={{ marginTop: '0.75rem', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText style={{ width: '12px', height: '12px' }} /> Jump to Source Passage (Page {currentQuestion.page_number})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation & Submit footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
            disabled={currentIdx === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(22, 30, 46, 0.6)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 16px', borderRadius: '8px', cursor: currentIdx === 0 ? 'not-allowed' : 'pointer', opacity: currentIdx === 0 ? 0.5 : 1 }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} /> Previous
          </button>

          {!gradeResult && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {answeredCount} of {questions.length} answered
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {currentIdx < questions.length - 1 && (
              <button
                onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent-primary)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
              >
                Next <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            )}
            {!gradeResult && (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || isGrading}
                title={allAnswered ? 'Grade every question' : 'Answer every question before submitting'}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: !allAnswered || isGrading ? 'not-allowed' : 'pointer',
                  opacity: !allAnswered || isGrading ? 0.55 : 1,
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Sparkles style={{ width: '16px', height: '16px' }} /> {isGrading ? 'Grading...' : 'Submit Quiz & Grade'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
