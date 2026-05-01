import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FileText, ListTodo, Sparkles, ChevronLeft, BrainCircuit, Award, Loader2, Share2 } from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { DocumentViewer } from '../components/document/DocumentViewer';
import { ChatPanel, ChatPanelRef } from '../components/ai/ChatPanel';
import { MindMapViewer } from '../components/mindmap/MindMapViewer';
import { Flashcards } from '../components/study/Flashcards';
import { DocumentQuiz } from '../components/quiz/DocumentQuiz';
import { QuizModal } from '../components/quiz/QuizModal';
import { TextSelectionToolbar } from '../components/document/TextSelectionToolbar';
import { VideoNoteEditor, VideoNoteEditorRef } from '../components/youtube/VideoNoteEditor';
import { SummaryPanel } from '../components/study/SummaryPanel';
import { WorkedProblemsPanel } from '../components/WorkedProblemsPanel';
import { documentService } from '../services/documentService';
import { apiClient } from '../services/apiClient';
import { ShareModal } from '../components/common/ShareModal';
import { ShareableQuiz, ShareableCard } from '../services/shareContentService';
import { TABS } from '../constants/tab';
import { cn } from '../utils/cn';
import { Document } from '../types';
import { getApiErrorCode } from '../utils/apiError';

export const DocumentDetailsPage: React.FC<{ embedded?: boolean; id?: string; initialDoc?: Document }> = ({ embedded, id: propId, initialDoc }) => {
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, documents, currentDocument, setCurrentDocument, chatMessages, updateDocumentInList } = useStudy();
  const initialTab = (location.state as any)?.activeTab ?? 'summary';
  const [activeTab, setActiveTab] = useState<'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat'>(initialTab);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryStreamText, setSummaryStreamText] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [docChatMessages, setDocChatMessages] = useState<Array<{ id: string; role: 'user' | 'model'; content: string; isError?: boolean }>>([]);
  const [noteContent, setNoteContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Ref to note editor for append-from-outside
  const noteEditorRef = useRef<VideoNoteEditorRef>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);

  // Set current document on navigation and fetch fresh data for latest AI-generated content
  useEffect(() => {
    if (!id) return;

    const doc = documents.find(d => d.id === id) ?? initialDoc;

    // Set from the loaded list when navigating or when documents finish loading
    if (doc && currentDocument?.id !== id) {
      setCurrentDocument(doc);
    }

    // Fetch fresh data from API once the doc is found in the list
    if (doc?.courseId) {
      documentService.getDocument(doc.courseId, id)
        .then(freshDoc => {
          // Merge: keep any AI content already set in state (e.g. just generated)
          // so a slow getDocument response can't overwrite freshly generated data
          setCurrentDocument(prev => {
            if (!prev || prev.id !== freshDoc.id) return freshDoc;
            return {
              ...freshDoc,
              mindMapText: freshDoc.mindMapText || prev.mindMapText,
              summary: freshDoc.summary || prev.summary,
            };
          });
          // Sync fresh data back to the documents list so DocumentsPage stays up to date
          updateDocumentInList(freshDoc);
        })
        .catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isLoading]); // isLoading signals when documents finish loading (refresh case)

  // Seed local chat messages from StudyContext when document changes
  useEffect(() => {
    setDocChatMessages(chatMessages.map(m => ({ id: m.id, role: m.role as 'user' | 'model', content: m.content })));
  }, [currentDocument?.id, chatMessages]);

  useEffect(() => {
    if (activeTab === 'chat') {
      // rAF ensures the panel is visible before we measure scrollHeight
      requestAnimationFrame(() => chatPanelRef.current?.scrollToBottom());
    }
  }, [activeTab]);

  // Load saved note when document changes
  useEffect(() => {
    if (!currentDocument?.courseId || !currentDocument?.id) return;
    setNoteId(null);
    setNoteContent('');
    documentService.getNotes(currentDocument.courseId, currentDocument.id)
      .then(notes => {
        if (notes.length > 0) {
          setNoteId(notes[0].id);
          setNoteContent(notes[0].content);
        }
      })
      .catch(() => { });
  }, [currentDocument?.id]);

  // Initialize summary from saved document data (also re-runs when fresh API data arrives)
  useEffect(() => {
    if (!currentDocument) return;

    setSummaryError(null);
    if (currentDocument.summary) {
      try {
        const parsed = JSON.parse(currentDocument.summary);
        const summaryText = (parsed.summary || '')
          + (parsed.keyPoints && parsed.keyPoints.length > 0
            ? '\n\n**Key Points:**\n' + parsed.keyPoints.map((p: string) => `- ${p}`).join('\n')
            : '');
        setSummary(summaryText || currentDocument.summary);
      } catch {
        setSummary(currentDocument.summary);
      }
    } else {
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDocument?.id, currentDocument?.summary]);

  const handleNoteSave = useCallback(async (html: string) => {
    if (!currentDocument?.courseId || !currentDocument?.id) return;
    setNoteContent(html);
    try {
      if (noteId) {
        await documentService.updateNote(currentDocument.courseId, currentDocument.id, noteId, html);
      } else {
        const note = await documentService.createNote(currentDocument.courseId, currentDocument.id, html);
        setNoteId(note.id);
      }
    } catch { }
  }, [currentDocument?.courseId, currentDocument?.id, noteId]);

  const generateSummary = async () => {
    if (!currentDocument) return;
    setIsSummarizing(true);
    setSummaryStreamText('');
    setSummaryError(null);
    try {
      let accumulated = '';
      await documentService.streamSummary(
        currentDocument.courseId || '',
        currentDocument.id,
        (chunk) => {
          accumulated += chunk;
          setSummaryStreamText(accumulated);
        },
      );
      setSummary(accumulated);
      setSummaryStreamText('');
      // Sync updated summary back to the documents list
      if (currentDocument) {
        const updated = { ...currentDocument, summary: accumulated };
        setCurrentDocument(updated);
        updateDocumentInList(updated);
      }
    } catch (error) {
      console.error('Summary error:', error);
      setSummary(null);
      setSummaryError(getApiErrorCode(error));
      setSummaryStreamText('');
    } finally {
      setIsSummarizing(false);
    }
  };


  const [activeView, setActiveView] = useState<'study' | 'document'>('document');

  // Text selection toolbar for summary
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryToolbar, setSummaryToolbar] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleSummaryMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection?.rangeCount) {
      setSummaryToolbar(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSummaryToolbar({
      x: rect.left + rect.width / 2,
      y: rect.top - 12,
      text,
    });
  }, []);

  const API_URL = import.meta.env.VITE_API_URL ?? '';
  const token = localStorage.getItem('sp_access_token');
  const authHeaders = useMemo(
    () => token ? { Authorization: `Bearer ${token}` } : undefined,
    [token]
  );

  // For real documents, stream through the API to avoid CORS issues with blob storage.
  // For the mock document (id === '123'), use the direct public URL.
  const viewUrl = currentDocument?.courseId
    ? `${API_URL}/api/courses/${currentDocument.courseId}/documents/${currentDocument.id}/file`
    : currentDocument?.url ?? '';

  if (!currentDocument) {
    return (
      <div className={cn("flex items-center justify-center bg-[var(--bg-app)]", embedded ? "h-full" : "h-screen")}>
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        ) : (
          <div className="text-center">
            <p className="text-text-muted">Document not found.</p>
            <button onClick={() => navigate('/documents')} className="mt-4 text-sm text-[var(--primary)] hover:underline">
              Back to Documents
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-[var(--bg-app)]", embedded ? "h-full" : "h-screen")}>
      {/* Top Bar */}
      {!embedded && (
        <div className="flex h-14 items-center justify-between border-b border-[var(--border-color)] px-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 max-w-[150px] sm:max-w-md">
              <FileText size={20} className="text-[var(--primary)] shrink-0" />
              <h1 className="text-sm font-semibold text-text-main truncate">{currentDocument.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-1.5 text-sm font-medium text-text-muted hover:border-primary/30 hover:text-primary transition-all"
            >
              <Share2 size={15} />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Panel - Document Viewer */}
        <div className={cn(
          "flex-1 overflow-hidden transition-opacity duration-300",
          activeView === 'document' ? "opacity-100" : "opacity-0 lg:opacity-100"
        )}>
          <DocumentViewer
            key={currentDocument.id}
            fileUrl={viewUrl}
            fileType={currentDocument.type as 'pdf' | 'docx' | 'txt' | 'md'}
            httpHeaders={authHeaders}
            onAskAI={(text) => {
              chatPanelRef.current?.setInput(text);
              setActiveTab('chat');
              setActiveView('study');
            }}
            onAddNoteText={(text) => {
              noteEditorRef.current?.appendContent(`<p>${text}</p>`);
              setActiveTab('notes');
              setActiveView('study');
            }}
            onAddNote={() => {
              setActiveTab('notes');
              setActiveView('study');
            }}
          />
        </div>

        {/* Right Panel - Study Tools */}
        <div className={cn(
          "absolute inset-0 z-20 bg-[var(--bg-app)] lg:relative lg:flex lg:flex-1 lg:border-l lg:border-[var(--border-color)] lg:bg-[var(--bg-sidebar)] transition-transform duration-300 lg:translate-x-0",
          activeView === 'study' ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}>
          <div className="flex flex-col h-full w-full">
            {/* Horizontal Tab Bar */}
            <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-x-auto no-scrollbar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors border-b-2 shrink-0',
                    activeTab === tab.id
                      ? 'border-[var(--primary)] text-[var(--primary)]'
                      : 'border-transparent text-text-muted hover:text-text-main'
                  )}
                >
                  <tab.icon size={15} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-sidebar)]">

              <div className={cn("flex-1 overflow-y-auto no-scrollbar", activeTab === 'chat' && "hidden")}>
                <div className={cn("h-full", activeTab !== 'summary' && "hidden")}>
                  <SummaryPanel
                    summary={summary}
                    isLoading={isSummarizing}
                    onGenerate={generateSummary}
                    loadingText="AI is analyzing your document..."
                    emptyText="Generate an AI summary."
                    error={summaryError}
                    onRetry={generateSummary}
                    streamingText={summaryStreamText}
                    summaryRef={summaryRef}
                    onMouseUp={handleSummaryMouseUp}
                  />
                </div>

                <div className={cn("h-full", activeTab !== 'mindmap' && "hidden")}>
                  <MindMapViewer />
                </div>

                <div className={cn("h-full", activeTab !== 'notes' && "hidden")}>
                  <VideoNoteEditor
                    ref={noteEditorRef}
                    videoRecordId={`doc-note-${currentDocument.id}`}
                    initialContent={noteContent}
                    onSave={handleNoteSave}
                  />
                </div>

                <div className={cn("h-full", activeTab !== 'flashcards' && "hidden")}>
                  <Flashcards />
                </div>

                <div className={cn("h-full", activeTab !== 'quiz' && "hidden")}>
                  <DocumentQuiz />
                </div>

                <div className={cn("h-full overflow-y-auto no-scrollbar", activeTab !== 'problems' && "hidden")}>
                  {currentDocument.courseId && (
                    <WorkedProblemsPanel documentId={currentDocument.id} />
                  )}
                </div>


              </div>

              <div className={cn("flex-1 overflow-hidden", activeTab !== 'chat' && "hidden")}>
                <ChatPanel
                  ref={chatPanelRef}
                  onTabChange={setActiveTab}
                  externalMessages={docChatMessages}
                  onExternalStreamSend={async (message, onChunk) => {
                    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: message };
                    setDocChatMessages(prev => [...prev, userMsg]);
                    let accumulated = '';
                    try {
                      await documentService.streamChat(
                        currentDocument.courseId || '',
                        currentDocument.id,
                        message,
                        (chunk) => { accumulated += chunk; onChunk(chunk); },
                      );
                      setDocChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: accumulated }]);
                    } catch (err) {
                      setDocChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: getApiErrorCode(err), isError: true }]);
                      throw err;
                    }
                  }}
                  onExternalAddToNote={(html) => {
                    noteEditorRef.current?.appendContent(html);
                    setActiveTab('notes');
                  }}
                />
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Mobile Bottom Navigation */}
      {!embedded && (
        <div className="flex h-16 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:hidden shrink-0">
          <button
            onClick={() => setActiveView('study')}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              activeView === 'study' ? "text-[var(--primary)]" : "text-text-muted"
            )}
          >
            <Sparkles size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Study</span>
          </button>
          <button
            onClick={() => setActiveView('document')}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              activeView === 'document' ? "text-[var(--primary)]" : "text-text-muted"
            )}
          >
            <FileText size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Doc</span>
          </button>
        </div>
      )}

      <QuizModal />

      {summaryToolbar && (
        <TextSelectionToolbar
          x={summaryToolbar.x}
          y={summaryToolbar.y}
          selectedText={summaryToolbar.text}
          onClose={() => setSummaryToolbar(null)}
          onAskAI={(text) => {
            chatPanelRef.current?.setInput(text);
            setActiveTab('chat');
            setActiveView('study');
          }}
          onAddNoteText={(text) => {
            noteEditorRef.current?.appendContent(`<p>${text}</p>`);
            setActiveTab('notes');
            setActiveView('study');
            setSummaryToolbar(null);
          }}
          onAddNote={() => {
            setActiveTab('notes');
            setActiveView('study');
          }}
        />
      )}

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={currentDocument.name}
        summary={summary}
        mindMapText={currentDocument.mindMapText}
        sourceType="document"
        sourceUrl={currentDocument.courseId ? `${currentDocument.courseId}/${currentDocument.id}` : undefined}
        notesHtml={noteContent || null}
        fetchQuizzes={currentDocument.courseId ? async () => {
          const qs = await documentService.getQuiz(currentDocument.courseId!, currentDocument.id);
          return qs.map((q: ShareableQuiz & { answer: string }) => ({ question: q.question, options: q.options ?? [], correctAnswer: q.answer, explanation: q.explanation }));
        } : undefined}
        fetchFlashcards={currentDocument.courseId ? async () => {
          const res = await apiClient.get<{ data: Array<{ front: string; back: string }> }>(`/api/courses/${currentDocument.courseId}/documents/${currentDocument.id}/flashcards`);
          return res.data.data.map((f: ShareableCard) => ({ front: f.front, back: f.back }));
        } : undefined}
      />
    </div>
  );
};
