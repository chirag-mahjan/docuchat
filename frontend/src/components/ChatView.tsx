import React, { useState, useRef, useEffect } from 'react';
import type { Message, Citation, Document } from '../types';
import { Send, Bot, User, FileText, Loader2, Sparkles, BookOpen, X } from 'lucide-react';

interface ChatViewProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  selectedDocs: Document[];
  onSendMessage: (query: string) => void;
  onCitationClick: (citation: Citation) => void;
  onRemoveDoc: (id: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  streamingText,
  isStreaming,
  selectedDocs,
  onSendMessage,
  onCitationClick,
  onRemoveDoc
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const findCitation = (citations: Citation[] | undefined, marker: number) => {
    if (!citations || citations.length === 0) return undefined;
    return citations.find((citation) => citation.index === marker) ?? citations[marker - 1];
  };

  const renderContentWithCitations = (content: string, citations?: Citation[]) => {
    const parts = content.split(/(\[\d+\]|【\d+】)/g);
    return parts.map((part, index) => {
      const match = part.match(/^[\[【](\d+)[\]】]$/);
      if (match) {
        const citationIndex = parseInt(match[1], 10);
        const matchedCitation = findCitation(citations, citationIndex);
        return (
          <span
            key={index}
            className="citation-badge"
            onClick={() => {
              if (matchedCitation) {
                onCitationClick(matchedCitation);
              } else if (citations && citations.length > 0) {
                onCitationClick(citations[0]);
              }
            }}
            title={matchedCitation ? `Page ${matchedCitation.page_number}: ${matchedCitation.snippet.slice(0, 180)}` : 'View Citation'}
          >
            [{citationIndex}]
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const readyDocs = selectedDocs.filter((doc) => doc.status === 'ready');
  const canAsk = readyDocs.length > 0 && !isStreaming;

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      {/* Scoped Documents Banner */}
      <div style={{ padding: '0.6rem 1.25rem', background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <BookOpen style={{ width: '16px', height: '16px', color: 'var(--accent-primary)' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scoped Documents:</span>
        {selectedDocs.length === 0 ? (
          <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 500 }}>No documents selected. Please check at least 1 document in the library.</span>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {selectedDocs.map(doc => (
              <span key={doc.id} style={{ background: doc.status === 'ready' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(251, 191, 36, 0.12)', border: `1px solid ${doc.status === 'ready' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(251, 191, 36, 0.35)'}`, color: doc.status === 'ready' ? '#818cf8' : '#fbbf24', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <FileText style={{ width: '12px', height: '12px' }} /> {doc.filename}
                {doc.status !== 'ready' && <span style={{ textTransform: 'capitalize' }}>({doc.status})</span>}
                <button
                  type="button"
                  onClick={() => onRemoveDoc(doc.id)}
                  title="Remove from scoped documents"
                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', marginLeft: '2px' }}
                >
                  <X style={{ width: '12px', height: '12px' }} />
                </button>
              </span>
            ))}
            {readyDocs.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Questions unlock when a selected document is Ready.</span>
            )}
          </div>
        )}
      </div>

      {/* Message History */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.length === 0 && !isStreaming && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-dim)', gap: '1rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <Sparkles style={{ width: '28px', height: '28px', color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600 }}>Ask your documents anything</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '400px' }}>
                Grounded answers with page citations back to exact source text passages.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className="animate-fade-in"
            style={{
              display: 'flex',
              gap: '0.85rem',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%'
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                <Bot style={{ width: '18px', height: '18px', color: '#fff' }} />
              </div>
            )}

            <div
              style={{
                background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(22, 30, 46, 0.8)',
                color: '#fff',
                padding: '0.85rem 1.1rem',
                borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                border: msg.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                boxShadow: msg.role === 'user' ? '0 4px 14px rgba(99, 102, 241, 0.3)' : 'none',
                lineHeight: '1.6',
                fontSize: '0.92rem'
              }}
            >
              <div>{renderContentWithCitations(msg.content, msg.citations)}</div>

              {/* Citations Footer */}
              {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Source Citations:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {msg.citations.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => onCitationClick(c)}
                        style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', borderRadius: '6px', padding: '3px 8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FileText style={{ width: '12px', height: '12px' }} /> [{c.index ?? i + 1}] {c.document_name || 'Doc'} (Page {c.page_number})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                <User style={{ width: '18px', height: '18px', color: '#fff' }} />
              </div>
            )}
          </div>
        ))}

        {/* Live Streaming Message */}
        {isStreaming && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '0.85rem', maxWidth: '85%' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
              <Bot style={{ width: '18px', height: '18px', color: '#fff' }} />
            </div>
            <div style={{ background: 'rgba(22, 30, 46, 0.8)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.85rem 1.1rem', borderRadius: '14px 14px 14px 2px', lineHeight: '1.6', fontSize: '0.92rem' }}>
              {streamingText ? (
                renderContentWithCitations(streamingText)
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                  <Loader2 className="animate-spin" style={{ width: '16px', height: '16px', color: 'var(--accent-primary)' }} />
                  <span>Searching documents & generating response...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} style={{ padding: '1rem 1.5rem', background: 'rgba(15, 23, 42, 0.8)', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(22, 30, 46, 0.7)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.4rem 0.6rem 0.4rem 1rem' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedDocs.length === 0 ? "Select at least 1 document to ask questions..." : readyDocs.length === 0 ? "Waiting for a selected document to finish processing..." : "Ask a question about your documents..."}
            disabled={!canAsk}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '0.92rem', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || !canAsk}
            style={{
              background: input.trim() && canAsk ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              cursor: input.trim() && canAsk ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
          >
            Send <Send style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </form>
    </div>
  );
};
