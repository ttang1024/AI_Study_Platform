import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Globe, ChevronLeft, Sparkles, AlertCircle, Share2,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { ChatPanel, ChatPanelRef } from '../components/ai/ChatPanel';
import { attachmentsToDisplay, type ChatMessageAttachment } from '../services/aiService';
import { MindMapViewer } from '../components/mindmap/MindMapViewer';
import { Flashcards } from '../components/study/Flashcards';
import { DocumentQuiz } from '../components/quiz/DocumentQuiz';
import { QuizModal } from '../components/quiz/QuizModal';
import { WorkedProblemsPanel } from '../components/WorkedProblemsPanel';
import { TextSelectionToolbar } from '../components/document/TextSelectionToolbar';
import { VideoNoteEditor, VideoNoteEditorRef } from '../components/youtube/VideoNoteEditor';
import { SummaryPanel } from '../components/study/SummaryPanel';
import { documentService } from '../services/documentService';
import { TABS } from '../constants/tab';
import { cn } from '../utils/cn';
import { getDocDisplayName } from '../utils/docName';
import { ShareModal } from '../components/common/ShareModal';
import { DetailPageSkeleton } from '../components/common/DetailPageSkeleton';
import { ArticleReader } from '../components/article/ArticleReader';
import { ShareableQuiz } from '../services/shareContentService';
import { Document } from '../types';
import { getApiErrorCode } from '../utils/apiError';

// ─── Article Page ─────────────────────────────────────────────────────────────

export const ArticlePage: React.FC<{ embedded?: boolean; id?: string; courseId?: string }> = ({ embedded, id: propId, courseId: propCourseId }) => {
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, documents, currentDocument, setCurrentDocument, chatMessages, updateDocumentInList, ensureDocuments } = useStudy();

  // The document list is loaded lazily by StudyContext; pull it so we can resolve
  // this article (and its courseId) on direct navigation / refresh.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);

  const initialTab = (location.state as any)?.activeTab ?? 'summary';
  const targetQuizQuestionId = (location.state as any)?.targetQuizQuestionId as string | undefined;
  const [activeTab, setActiveTab] = useState<'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat'>(initialTab);
  const [activeView, setActiveView] = useState<'study' | 'article'>('article');

  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryStreamText, setSummaryStreamText] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [noteContent, setNoteContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareQuizzesAvailable, setShareQuizzesAvailable] = useState(false);
  // Cache the quizzes fetched for the availability check so sharing reuses them
  // instead of refetching the same list.
  const shareQuizzesRef = useRef<Awaited<ReturnType<typeof documentService.getQuiz>> | null>(null);

  const [toolbar, setToolbar] = useState<{ x: number; y: number; text: string } | null>(null);
  const [summaryToolbar, setSummaryToolbar] = useState<{ x: number; y: number; text: string } | null>(null);

  const noteEditorRef = useRef<VideoNoteEditorRef>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);
  // Tracks the document id we've already fetched fresh data for, so re-running
  // the fetch effect (updateDocumentInList mutates the documents list) doesn't
  // refetch the same document in a loop.
  const fetchedDocIdRef = useRef<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [docChatMessages, setDocChatMessages] = useState<Array<{ id: string; role: 'user' | 'model'; content: string; isError?: boolean; attachments?: ChatMessageAttachment[] }>>([]);
  const [isDocumentLoading, setIsDocumentLoading] = useState(true);

  // ── Load document ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const doc = documents.find(d => d.id === id);

    if (doc && currentDocument?.id !== id) {
      setCurrentDocument(doc);
    }

    // Fetch fresh data once the document's courseId is known
    const courseId = propCourseId ?? doc?.courseId ?? (location.state as any)?.courseId;
    if (courseId && fetchedDocIdRef.current !== id) {
      fetchedDocIdRef.current = id;
      setIsDocumentLoading(true);
      documentService.getDocument(courseId, id)
        .then(freshDoc => {
          setCurrentDocument(prev => {
            if (!prev || prev.id !== freshDoc.id) return freshDoc;
            return {
              ...freshDoc,
              mindMapText: freshDoc.mindMapText || prev.mindMapText,
              summary: freshDoc.summary || prev.summary,
            };
          });
          updateDocumentInList(freshDoc);
        })
        .catch(() => { })
        .finally(() => setIsDocumentLoading(false));
    } else {
      setIsDocumentLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isLoading, documents]); // re-run once the lazily-loaded list arrives so the doc resolves

  // ── Seed chat from context ─────────────────────────────────────────────────
  useEffect(() => {
    setDocChatMessages(chatMessages.map(m => ({ id: m.id, role: m.role as 'user' | 'model', content: m.content, attachments: m.attachments })));
  }, [currentDocument?.id, chatMessages]);

  // ── Load note ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentDocument?.courseId || !currentDocument?.id) return;
    setNoteId(null);
    setNoteContent('');
    setShareQuizzesAvailable(false);
    documentService.getNotes(currentDocument.courseId, currentDocument.id)
      .then(notes => {
        if (notes.length > 0) {
          setNoteId(notes[0].id);
          setNoteContent(notes[0].content);
        }
      })
      .catch(() => { });
  }, [currentDocument?.id]);

  useEffect(() => {
    if (!showShareModal || !currentDocument?.courseId || !currentDocument?.id) return;
    let cancelled = false;
    documentService.getQuiz(currentDocument.courseId, currentDocument.id)
      .then(qs => { if (!cancelled) { shareQuizzesRef.current = qs; setShareQuizzesAvailable(qs.length > 0); } })
      .catch(() => { if (!cancelled) { shareQuizzesRef.current = null; setShareQuizzesAvailable(false); } });
    return () => { cancelled = true; };
  }, [showShareModal, currentDocument?.courseId, currentDocument?.id]);

  // ── Seed summary from saved data ───────────────────────────────────────────
  useEffect(() => {
    if (!currentDocument) return;
    setSummaryError(null);
    if (currentDocument.summary) {
      try {
        const parsed = JSON.parse(currentDocument.summary);
        const text = (parsed.summary || '')
          + (parsed.keyPoints?.length ? '\n\n**Key Points:**\n' + parsed.keyPoints.map((p: string) => `- ${p}`).join('\n') : '');
        setSummary(text || currentDocument.summary);
      } catch {
        setSummary(currentDocument.summary);
      }
    } else {
      setSummary(null);
    }
  }, [currentDocument?.id, currentDocument?.summary]);

  // ── Handlers ───────────────────────────────────────────────────────────────
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
        (chunk) => { accumulated += chunk; setSummaryStreamText(accumulated); },
      );
      setSummary(accumulated);
      setSummaryStreamText('');
      const updated = { ...currentDocument, summary: accumulated };
      setCurrentDocument(updated);
      updateDocumentInList(updated);
    } catch (err) {
      setSummary(null);
      setSummaryError(getApiErrorCode(err));
      setSummaryStreamText('');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleArticleTextSelect = useCallback((x: number, y: number, text: string) => {
    setToolbar({ x, y, text });
  }, []);

  const handleSummaryMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection?.rangeCount) { setSummaryToolbar(null); return; }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSummaryToolbar({ x: rect.left + rect.width / 2, y: rect.top - 12, text });
  }, []);

  // ── Not found / loading ────────────────────────────────────────────────────
  if (!currentDocument && !isLoading) {
    // Try to set from location state if we just navigated here
    const stateDoc = (location.state as any)?.doc as Document | undefined;
    if (stateDoc && id && stateDoc.id === id) {
      setCurrentDocument(stateDoc);
    }
  }

  if (!currentDocument) {
    return (
      <div className={cn("bg-[var(--bg-app)]", embedded ? "h-full" : "h-screen")}>
        {(isLoading || isDocumentLoading) ? <DetailPageSkeleton variant="article" embedded={embedded} /> : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-text-muted">Article not found.</p>
              <button onClick={() => navigate('/summarizer')} className="mt-4 text-sm text-[var(--primary)] hover:underline">
                Back to Summarizer
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-[var(--bg-app)]", embedded ? "h-full" : "h-screen")}>
      {/* ── Top bar ── */}
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
              <Globe size={20} className="text-[var(--primary)] shrink-0" />
              <h1 className="text-sm font-semibold text-text-main truncate">
                {getDocDisplayName(currentDocument)}
              </h1>
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
        {/* ── Left panel — Article reader ── */}
        <div className={cn(
          'flex-1 overflow-hidden transition-opacity duration-300',
          activeView === 'article' ? 'opacity-100' : 'opacity-0 lg:opacity-100',
        )}>
          <ArticleReader
            document={currentDocument}
            onTextSelect={handleArticleTextSelect}
          />
        </div>

        {/* ── Right panel — Study tools ── */}
        <div className={cn(
          'absolute inset-0 z-20 bg-[var(--bg-app)] lg:relative lg:flex lg:flex-1 lg:border-l lg:border-[var(--border-color)] lg:bg-[var(--bg-sidebar)] transition-transform duration-300 lg:translate-x-0',
          activeView === 'study' ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
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
                      : 'border-transparent text-text-muted hover:text-text-main',
                  )}
                >
                  <tab.icon size={15} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-sidebar)]">
              <div className={cn('flex-1 overflow-y-auto no-scrollbar', activeTab === 'chat' && 'hidden')}>
                <div className={cn('h-full', activeTab !== 'summary' && 'hidden')}>
                  <SummaryPanel
                    summary={summary}
                    isLoading={isSummarizing}
                    onGenerate={generateSummary}
                    loadingText="AI is reading your article…"
                    emptyText="Generate an AI summary of this article."
                    error={summaryError}
                    onRetry={generateSummary}
                    streamingText={summaryStreamText}
                    summaryRef={summaryRef}
                    onMouseUp={handleSummaryMouseUp}
                  />
                </div>
                <div className={cn('h-full', activeTab !== 'mindmap' && 'hidden')}>
                  <MindMapViewer />
                </div>
                <div className={cn('h-full', activeTab !== 'notes' && 'hidden')}>
                  <VideoNoteEditor
                    ref={noteEditorRef}
                    videoRecordId={`article-note-${currentDocument.id}`}
                    initialContent={noteContent}
                    onSave={handleNoteSave}
                  />
                </div>
                <div className={cn('h-full', activeTab !== 'flashcards' && 'hidden')}>
                  <Flashcards />
                </div>
                <div className={cn('h-full', activeTab !== 'quiz' && 'hidden')}>
                  <DocumentQuiz targetQuestionId={targetQuizQuestionId} />
                </div>
                <div className={cn('h-full overflow-y-auto no-scrollbar', activeTab !== 'problems' && 'hidden')}>
                  {currentDocument.courseId && (
                    <WorkedProblemsPanel documentId={currentDocument.id} />
                  )}
                </div>
              </div>

              <div className={cn('flex-1 overflow-hidden', activeTab !== 'chat' && 'hidden')}>
                <ChatPanel
                  ref={chatPanelRef}
                  onTabChange={setActiveTab}
                  externalMessages={docChatMessages}
                  enableAttachments
                  onExternalStreamSend={async (message, onChunk, attachments) => {
                    const userMsg = { id: Date.now().toString(), role: 'user' as const, content: message, attachments: attachmentsToDisplay(attachments) };
                    setDocChatMessages(prev => [...prev, userMsg]);
                    let accumulated = '';
                    try {
                      await documentService.streamChat(
                        currentDocument.courseId || '',
                        currentDocument.id,
                        message,
                        (chunk) => { accumulated += chunk; onChunk(chunk); },
                        undefined,
                        attachments,
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

      {/* ── Mobile bottom nav ── */}
      <div className="flex h-16 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:hidden shrink-0">
        <button
          onClick={() => setActiveView('study')}
          className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'study' ? 'text-[var(--primary)]' : 'text-text-muted')}
        >
          <Sparkles size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Study</span>
        </button>
        <button
          onClick={() => setActiveView('article')}
          className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'article' ? 'text-[var(--primary)]' : 'text-text-muted')}
        >
          <Globe size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Article</span>
        </button>
      </div>

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={getDocDisplayName(currentDocument)}
        summary={summary}
        mindMapText={currentDocument.mindMapText}
        notesHtml={noteContent || null}
        sourceType="article"
        sourceUrl={currentDocument.courseId && currentDocument.id ? `${currentDocument.courseId}/${currentDocument.id}` : null}
        originalArticleUrl={currentDocument.originalUrl || null}
        fetchQuizzes={currentDocument.courseId && shareQuizzesAvailable ? async () => {
          const qs = shareQuizzesRef.current ?? await documentService.getQuiz(currentDocument.courseId!, currentDocument.id);
          return qs.map(q => ({
            question: q.question,
            options: q.options ?? [],
            correctAnswer: q.answer,
            explanation: q.explanation ?? '',
            difficulty: q.difficulty ?? 'medium',
          } satisfies ShareableQuiz));
        } : undefined}
      />

      <QuizModal />

      {/* Text selection toolbar — article body */}
      {toolbar && (
        <TextSelectionToolbar
          x={toolbar.x}
          y={toolbar.y}
          selectedText={toolbar.text}
          onClose={() => setToolbar(null)}
          onAskAI={(text) => {
            chatPanelRef.current?.setInput(text);
            setActiveTab('chat');
            setActiveView('study');
            setToolbar(null);
          }}
          onAddNoteText={(text) => {
            noteEditorRef.current?.appendContent(`<p>${text}</p>`);
            setActiveTab('notes');
            setActiveView('study');
            setToolbar(null);
          }}
          onAddNote={() => {
            setActiveTab('notes');
            setActiveView('study');
            setToolbar(null);
          }}
        />
      )}

      {/* Text selection toolbar — summary panel */}
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
            setSummaryToolbar(null);
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
            setSummaryToolbar(null);
          }}
        />
      )}
    </div>
  );
};
