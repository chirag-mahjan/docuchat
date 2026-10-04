import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { DocumentLibrary } from './components/DocumentLibrary';
import { ChatView } from './components/ChatView';
import { SourceViewer } from './components/SourceViewer';
import { QuizModal } from './components/QuizModal';
import { QuizView } from './components/QuizView';
import { api } from './api/client';
import { FileText, Sparkles, Loader2 } from 'lucide-react';
import type { Document, Conversation, Message, Citation, Quiz, QuizDifficulty } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'quiz'>('chat');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Active Conversation state
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Citation viewer side panel state
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  // Quiz state
  const [quizDoc, setQuizDoc] = useState<Document | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizJob, setQuizJob] = useState<{ filename: string; difficulty: QuizDifficulty; count: number } | null>(null);
  const streamingRef = useRef('');
  const quizPollRef = useRef<number | null>(null);

  const stopQuizPoll = () => {
    if (quizPollRef.current !== null) {
      window.clearInterval(quizPollRef.current);
      quizPollRef.current = null;
    }
  };

  useEffect(() => () => stopQuizPoll(), []);

  // 1. Initial documents load
  const loadDocuments = async () => {
    try {
      const docs = await api.listDocuments();
      setApiError(null);
      setDocuments(docs);
      // Auto-select ready documents if none selected yet
      if (selectedDocIds.length === 0) {
        const readyIds = docs.filter(d => d.status === 'ready').map(d => d.id);
        setSelectedDocIds(readyIds);
      }
    } catch (err: any) {
      setApiError(err.message || 'Failed to load documents');
    }
  };

  useEffect(() => {
    loadDocuments();
    const interval = setInterval(() => {
      api.listDocuments().then(docs => {
        setApiError(null);
        setDocuments(docs);
      }).catch((err: any) => {
        setApiError(err.message || 'Failed to load documents');
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // 2. Manage or create active conversation when doc selection changes
  useEffect(() => {
    if (selectedDocIds.length > 0 && !conversation) {
      api.createConversation(selectedDocIds).then(conv => {
        setConversation(conv);
        setMessages(conv.messages || []);
      }).catch(err => console.error('Error creating conversation:', err));
    }
  }, [selectedDocIds]);

  // Document Library Handlers
  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const newDoc = await api.uploadDocument(file);
      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDocIds(prev => [...prev, newDoc.id]);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDocs = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedDocIds(documents.map(d => d.id));
    } else {
      setSelectedDocIds([]);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
      setSelectedDocIds(prev => prev.filter(item => item !== id));
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const sameDocScope = (left: string[], right: string[]) => {
    if (left.length !== right.length) return false;
    const rightSet = new Set(right.map(String));
    return left.every((id) => rightSet.has(String(id)));
  };

  // Chat Handlers
  const handleSendMessage = async (query: string) => {
    const readyIds = documents
      .filter((doc) => selectedDocIds.includes(doc.id) && doc.status === 'ready')
      .map((doc) => doc.id);

    if (readyIds.length === 0) {
      alert('Wait until at least one selected document is Ready before asking a question.');
      return;
    }

    let currentConv = conversation;
    const scopeChanged = !currentConv || !sameDocScope(currentConv.document_ids.map(String), readyIds);
    if (scopeChanged) {
      try {
        currentConv = await api.createConversation(readyIds);
        setConversation(currentConv);
      } catch (err: any) {
        alert(err.message || 'Could not start a conversation for the selected documents.');
        return;
      }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      conversation_id: currentConv.id,
      role: 'user',
      content: query,
      created_at: new Date().toISOString()
    };

    setMessages((prev) => (scopeChanged ? [userMsg] : [...prev, userMsg]));
    streamingRef.current = '';
    setStreamingText('');
    setIsStreaming(true);

    await api.streamSendMessage(
      currentConv.id,
      query,
      (token) => {
        streamingRef.current += token;
        setStreamingText(streamingRef.current);
      },
      (citations) => {
        const content = streamingRef.current;
        streamingRef.current = '';
        const asstMsg: Message = {
          id: (Date.now() + 1).toString(),
          conversation_id: currentConv!.id,
          role: 'assistant',
          content,
          citations,
          created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, asstMsg]);
        setStreamingText('');
        setIsStreaming(false);
      },
      (err) => {
        const partial = streamingRef.current;
        streamingRef.current = '';
        if (partial) {
          setMessages((prev) => [...prev, {
            id: (Date.now() + 1).toString(),
            conversation_id: currentConv!.id,
            role: 'assistant',
            content: partial,
            created_at: new Date().toISOString()
          }]);
        }
        setStreamingText('');
        setIsStreaming(false);
        alert(`Stream error: ${err}`);
      }
    );
  };

  // Quiz Handlers
  const handleOpenQuizModal = (doc: Document) => {
    setQuizDoc(doc);
  };

  const handleGenerateQuiz = async (docId: string, difficulty: QuizDifficulty, count: number) => {
    stopQuizPoll();
    setQuizError(null);
    setActiveQuiz(null);
    setIsGeneratingQuiz(true);
    const source = documents.find((doc) => doc.id === docId);
    setQuizJob({
      filename: source?.filename || 'Document',
      difficulty,
      count
    });

    try {
      const quiz = await api.createQuiz(docId, difficulty, count);
      setQuizDoc(null);
      setActiveTab('quiz');

      let attempts = 0;
      quizPollRef.current = window.setInterval(async () => {
        attempts += 1;
        try {
          const updated = await api.getQuiz(quiz.id);
          if (updated.status === 'ready') {
            stopQuizPoll();
            setActiveQuiz(updated);
            setIsGeneratingQuiz(false);
            setQuizJob(null);
          } else if (updated.status === 'failed' || attempts > 60) {
            stopQuizPoll();
            setIsGeneratingQuiz(false);
            setQuizJob(null);
            setQuizError(
              updated.status === 'failed'
                ? 'Quiz generation failed. The document may not have enough text, or the model returned an unusable response.'
                : 'Quiz generation is taking too long. Try again with fewer questions.'
            );
          }
        } catch {
          stopQuizPoll();
          setIsGeneratingQuiz(false);
          setQuizJob(null);
          setQuizError('Could not check quiz status. Please try again.');
        }
      }, 2000);
    } catch (err: any) {
      const message = err.message || 'Failed to start quiz generation';
      setIsGeneratingQuiz(false);
      setQuizJob(null);
      setQuizError(message);
      alert(message);
    }
  };

  const handleResetQuiz = () => {
    stopQuizPoll();
    setActiveQuiz(null);
    setIsGeneratingQuiz(false);
    setQuizJob(null);
    setQuizError(null);
  };

  const selectedDocs = documents.filter(d => selectedDocIds.includes(d.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} selectedDocCount={selectedDocIds.length} />

      {apiError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fecaca', borderBottom: '1px solid rgba(239, 68, 68, 0.35)', padding: '0.55rem 1.25rem', fontSize: '0.82rem' }}>
          {apiError}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Document Sidebar */}
        <DocumentLibrary
          documents={documents}
          selectedDocIds={selectedDocIds}
          onToggleSelectDoc={handleToggleSelectDoc}
          onSelectAllDocs={handleSelectAllDocs}
          onUploadFile={handleUploadFile}
          onDeleteDoc={handleDeleteDoc}
          onOpenQuizModal={handleOpenQuizModal}
          isUploading={isUploading}
        />

        {/* Main Content View */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', position: 'relative' }}>
        {activeTab === 'chat' ? (
          <ChatView
            messages={messages}
            streamingText={streamingText}
            isStreaming={isStreaming}
            selectedDocs={selectedDocs}
            onSendMessage={handleSendMessage}
            onCitationClick={(citation) => setActiveCitation(citation)}
            onRemoveDoc={handleToggleSelectDoc}
          />
        ) : (
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            {activeQuiz ? (
              <QuizView
                quiz={activeQuiz}
                onGradeQuiz={(answers) => api.gradeQuiz(activeQuiz.id, answers)}
                onCitationClick={(citation) => setActiveCitation(citation)}
                onResetQuiz={handleResetQuiz}
              />
            ) : isGeneratingQuiz ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
                <Loader2 className="animate-spin" style={{ width: '32px', height: '32px', color: '#34d399' }} />
                <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>Generating your quiz</p>
                <p style={{ fontSize: '0.85rem', maxWidth: '420px' }}>
                  {quizJob
                    ? `${quizJob.count} ${quizJob.difficulty} questions from ${quizJob.filename}. This stays on this screen until the quiz is ready.`
                    : 'Building questions from the document. This stays on this screen until the quiz is ready.'}
                </p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '1rem', padding: '2rem', overflowY: 'auto' }}>
                {quizError && (
                  <p style={{ fontSize: '0.85rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', padding: '0.65rem 0.9rem', maxWidth: '480px' }}>
                    {quizError}
                  </p>
                )}
                {(() => {
                  const readySelected = selectedDocs.filter(d => d.status === 'ready');
                  const readyAll = documents.filter(d => d.status === 'ready');
                  const candidates = readySelected.length > 0 ? readySelected : readyAll;
                  const notReady = documents.filter(d => d.status !== 'ready' && d.status !== 'failed');
                  const failed = documents.filter(d => d.status === 'failed');

                  if (candidates.length === 0) {
                    if (documents.length === 0) {
                      return <p>No documents yet. Upload a document in the left library panel first.</p>;
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', maxWidth: '440px' }}>
                        <p style={{ fontSize: '0.9rem' }}>
                          {notReady.length > 0
                            ? `${notReady.length} document${notReady.length > 1 ? 's are' : ' is'} still processing. MCQ generation unlocks when status is Ready:`
                            : failed.length > 0
                              ? 'All documents failed processing. Check the library panel for errors, then retry upload.'
                              : 'No ready documents yet. Upload a document in the left library panel first.'}
                        </p>
                        {notReady.map(doc => (
                          <div key={doc.id} className="glass-panel" style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.filename}</span>
                            <span style={{ fontSize: '0.72rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: '10px', textTransform: 'capitalize', flexShrink: 0 }}>
                              {doc.status}…
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <>
                      <p style={{ fontSize: '0.9rem' }}>
                        {readySelected.length > 0
                          ? 'These documents are selected from Doc Q&A Chat. Pick one to generate an MCQ quiz:'
                          : 'Pick a ready document to generate an MCQ quiz:'}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', maxWidth: '480px' }}>
                        {candidates.map(doc => (
                          <div key={doc.id} className="glass-panel glass-panel-hover" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <FileText style={{ width: '16px', height: '16px', color: 'var(--accent-primary)', flexShrink: 0 }} />
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.filename}</span>
                            </div>
                            <button
                              onClick={() => handleOpenQuizModal(doc)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.78rem', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                            >
                              <Sparkles style={{ width: '13px', height: '13px' }} /> Generate Quiz…
                            </button>
                          </div>
                        ))}
                      </div>
                      {notReady.length > 0 && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                          {notReady.length} more document{notReady.length > 1 ? 's' : ''} still processing…
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        <SourceViewer citation={activeCitation} onClose={() => setActiveCitation(null)} />
        </div>
      </div>

      {/* Quiz Modal */}
      <QuizModal
        document={quizDoc}
        onClose={() => setQuizDoc(null)}
        onGenerate={handleGenerateQuiz}
        isGenerating={isGeneratingQuiz}
      />
    </div>
  );
};

export default App;
