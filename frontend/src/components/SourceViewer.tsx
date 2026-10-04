import React from 'react';
import type { Citation } from '../types';
import { X, FileText, Bookmark } from 'lucide-react';

interface SourceViewerProps {
  citation: Citation | null;
  onClose: () => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.35)', zIndex: 4 }} />
    <div className="glass-panel animate-fade-in" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(360px, 100%)', borderTop: 0, borderBottom: 0, borderRight: 0, borderRadius: 0, display: 'flex', flexDirection: 'column', zIndex: 5, boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.35)' }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bookmark style={{ width: '18px', height: '18px', color: 'var(--accent-primary)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Source Passage Citation</h3>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X style={{ width: '18px', height: '18px' }} />
        </button>
      </div>

      {/* Meta details */}
      <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.4)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileText style={{ width: '14px', height: '14px', color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{citation.document_name || 'Document'}</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Page Number: <strong style={{ color: '#818cf8' }}>{citation.page_number}</strong></span>
          <span>Chunk ID: <code style={{ fontSize: '0.7rem' }}>{citation.chunk_id.slice(0, 8)}</code></span>
        </div>
      </div>

      {/* Content passage viewer */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Exact Text Context:
        </span>
        <div style={{ marginTop: '0.75rem', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-active)', padding: '1rem', borderRadius: '10px', lineHeight: '1.6', fontSize: '0.88rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
          {citation.snippet}
        </div>
      </div>
    </div>
    </>
  );
};
