import React, { useState, useRef } from 'react';
import type { Document } from '../types';
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle, Trash2, Sparkles, CheckSquare, Square, Clock } from 'lucide-react';

interface DocumentLibraryProps {
  documents: Document[];
  selectedDocIds: string[];
  onToggleSelectDoc: (id: string) => void;
  onSelectAllDocs: (selectAll: boolean) => void;
  onUploadFile: (file: File) => void;
  onDeleteDoc: (id: string) => void;
  onOpenQuizModal: (doc: Document) => void;
  isUploading: boolean;
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
  documents,
  selectedDocIds,
  onToggleSelectDoc,
  onSelectAllDocs,
  onUploadFile,
  onDeleteDoc,
  onOpenQuizModal,
  isUploading
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      alert('Use a PDF, DOCX, TXT, or Markdown file.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert('File exceeds the 25MB limit.');
      return;
    }
    if (file.size === 0) {
      alert('The selected file is empty.');
      return;
    }
    onUploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      submitFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      submitFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const renderStatusBadge = (doc: Document) => {
    const stageLabels: Record<string, string> = {
      parsing: 'Parsing document',
      chunking: 'Splitting into chunks',
      embedding: 'Generating embeddings',
    };

    switch (doc.status) {
      case 'ready':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
            <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Ready ({doc.page_count} pgs)
          </span>
        );
      case 'failed':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '12px' }} title={doc.error_message}>
            <AlertCircle style={{ width: '12px', height: '12px' }} /> Failed
          </span>
        );
      case 'uploaded':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '2px 8px', borderRadius: '12px' }} title="File received — waiting for background processing to start">
            <Clock style={{ width: '12px', height: '12px' }} /> Queued
          </span>
        );
      case 'parsing':
      case 'chunking':
      case 'embedding':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: '12px' }}>
            <Loader2 className="animate-spin" style={{ width: '12px', height: '12px' }} />
            {stageLabels[doc.status]}...
          </span>
        );
      default:
        return null;
    }
  };

  const allSelected = documents.length > 0 && selectedDocIds.length === documents.length;

  return (
    <div className="glass-panel" style={{ width: '320px', minWidth: '320px', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: 0, borderBottom: 0, borderLeft: 0, borderRadius: 0 }}>
      {/* Upload Zone */}
      <div style={{ padding: '1rem' }}>
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragOver ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '12px',
            padding: '1.25rem 1rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragOver ? 'rgba(99, 102, 241, 0.1)' : 'rgba(15, 23, 42, 0.4)',
            transition: 'all 0.2s ease'
          }}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }} onChange={handleFileChange} />
          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <Loader2 className="animate-spin" style={{ width: '28px', height: '28px', color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Processing upload...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <Upload style={{ width: '24px', height: '24px', color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Click or Drag PDF / DOCX / TXT</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Max file size 25MB</span>
            </div>
          )}
        </div>
      </div>

      {/* Header & Controls */}
      <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Documents ({documents.length})
        </span>

        {documents.length > 0 && (
          <button
            onClick={() => onSelectAllDocs(!allSelected)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}
          >
            {allSelected ? <CheckSquare style={{ width: '14px', height: '14px' }} /> : <Square style={{ width: '14px', height: '14px' }} />}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Document List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem 1rem', fontSize: '0.85rem' }}>
            No documents uploaded yet. Upload one above to get started!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {documents.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  className="glass-panel glass-panel-hover"
                  style={{
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(22, 30, 46, 0.5)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectDoc(doc.id)}
                      style={{ marginTop: '3px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                    <FileText style={{ width: '18px', height: '18px', color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.filename}
                      </p>
                      <div style={{ marginTop: '2px' }}>{renderStatusBadge(doc)}</div>
                      {doc.status === 'failed' && doc.error_message && (
                        <p title={doc.error_message} style={{ marginTop: '4px', fontSize: '0.68rem', color: '#f87171', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.error_message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {doc.status === 'ready' ? (
                      <button
                        onClick={() => onOpenQuizModal(doc)}
                        title="Generate MCQ quiz — choose Easy / Medium / Hard / Mixed difficulty in the next step"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                      >
                        <Sparkles style={{ width: '12px', height: '12px' }} /> Quiz…
                      </button>
                    ) : (
                      <span />
                    )}

                    <button
                      onClick={() => onDeleteDoc(doc.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px', borderRadius: '4px' }}
                      title="Delete document"
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
