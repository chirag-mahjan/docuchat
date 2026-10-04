import React from 'react';
import { BookOpen, Sparkles, FileText } from 'lucide-react';

interface NavbarProps {
  activeTab: 'chat' | 'quiz';
  setActiveTab: (tab: 'chat' | 'quiz') => void;
  selectedDocCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, selectedDocCount }) => {
  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)' }}>
          <BookOpen style={{ color: '#fff', width: '22px', height: '22px' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            DocuChat
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grounded Document Intelligence & MCQ Quizzes</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '6px 14px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activeTab === 'chat' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'chat' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <FileText style={{ width: '15px', height: '15px' }} />
          Doc Q&A Chat
          {selectedDocCount > 0 && (
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
              {selectedDocCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '6px 14px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activeTab === 'quiz' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
            color: activeTab === 'quiz' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Sparkles style={{ width: '15px', height: '15px' }} />
          MCQ Quiz Generator
        </button>
      </div>
    </header>
  );
};
