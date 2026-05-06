import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Globe, ChevronLeft, Sparkles, Loader2, AlertCircle, Share2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useStudy } from '../context/StudyContext';
import { ChatPanel, ChatPanelRef } from '../components/ai/ChatPanel';
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
import { Document } from '../types';
import { getApiErrorCode } from '../utils/apiError';
import { getApiUrl } from '../utils/env';

// ─── Article Reader ───────────────────────────────────────────────────────────

// Defined outside the component so the reference is stable across re-renders,
// preventing ReactMarkdown from re-processing content on every parent render.
const MARKDOWN_COMPONENTS = {
  h1: ({ children }: { children: React.ReactNode }) => <h1 className="text-2xl font-black mt-8 mb-3 text-text-main">{children}</h1>,
  h2: ({ children }: { children: React.ReactNode }) => <h2 className="text-xl font-bold mt-6 mb-2 text-text-main">{children}</h2>,
  h3: ({ children }: { children: React.ReactNode }) => <h3 className="text-lg font-semibold mt-5 mb-2 text-text-main">{children}</h3>,
  h4: ({ children }: { children: React.ReactNode }) => <h4 className="text-base font-semibold mt-4 mb-1 text-text-main">{children}</h4>,
  h5: ({ children }: { children: React.ReactNode }) => <h5 className="text-sm font-semibold mt-3 mb-1 text-text-main">{children}</h5>,
  h6: ({ children }: { children: React.ReactNode }) => <h6 className="text-xs font-semibold mt-3 mb-1 text-text-muted">{children}</h6>,
  p: ({ children }: { children: React.ReactNode }) => <p className="mb-4">{children}</p>,
  ul: ({ children }: { children: React.ReactNode }) => <ul className="mb-4 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }: { children: React.ReactNode }) => <ol className="mb-4 ml-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }: { children: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }: { children: React.ReactNode }) => (
    <blockquote className="my-4 border-l-4 border-[var(--primary)] pl-4 text-text-muted italic">{children}</blockquote>
  ),
  strong: ({ children }: { children: React.ReactNode }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }: { children: React.ReactNode }) => <em className="italic">{children}</em>,
  a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline underline-offset-2 hover:opacity-80">{children}</a>
  ),
  hr: () => <hr className="my-6 border-[var(--border-color)]" />,
  img: ({ src, alt }: { src?: string; alt?: string }) => (
    <span className="block my-4">
      <img
        src={src}
        alt={alt ?? ''}
        className="max-w-full rounded-lg shadow-sm"
        loading="lazy"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      {alt && <span className="mt-1 block text-center text-xs text-text-muted italic">{alt}</span>}
    </span>
  ),
  code: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    className
      ? <code className={`${className} text-sm font-mono`}>{children}</code>
      : <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm font-mono">{children}</code>,
  pre: ({ children }: { children: React.ReactNode }) => <pre className="mb-4 overflow-x-auto rounded-lg bg-zinc-900 text-zinc-100 p-4 text-sm font-mono">{children}</pre>,
};

interface ArticleReaderProps {
  document: Document;
  onTextSelect: (x: number, y: number, text: string) => void;
}

const ArticleReader: React.FC<ArticleReaderProps> = React.memo(({ document, onTextSelect }) => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  const API_URL = getApiUrl();

  useEffect(() => {
    if (!document.courseId || !document.id) return;
    setIsLoading(true);
    setError(null);

    const token = localStorage.getItem('sp_access_token');
    fetch(`${API_URL}/api/courses/${document.courseId}/documents/${document.id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load article content');
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Could not load article content.');
        setIsLoading(false);
      });
  }, [document.id, document.courseId]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    onTextSelect(rect.left + rect.width / 2, rect.top - 12, text);
  }, [onTextSelect]);

  const articleTitle = document.name.replace(/\.(txt|md)$/i, '');

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          <p className="text-sm text-text-muted">Loading article…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-2xl bg-red-50 p-4 text-red-500">
            <AlertCircle size={28} />
          </div>
          <p className="text-sm text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-app)]">
      <div
        ref={readerRef}
        className="mx-auto max-w-2xl px-8 py-10 pb-20 select-text"
        onMouseUp={handleMouseUp}
      >
        {/* Article title */}
        <h1 className="mb-2 text-2xl font-black tracking-tight text-text-main leading-tight">
          {articleTitle}
        </h1>

        {/* Meta */}
        <div className="mb-8 flex items-center gap-2 text-xs text-text-muted border-b border-[var(--border-color)] pb-4">
          <Globe size={12} />
          <span>Web article</span>
          <span>·</span>
          <span>{new Date(document.uploadDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>

        {/* Article body */}
        <div className="article-body text-[15px] leading-relaxed text-text-main break-words font-[system-ui,sans-serif]">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={MARKDOWN_COMPONENTS}>
            {content ?? ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
});

// ─── Article Page ─────────────────────────────────────────────────────────────

export const ArticlePage: React.FC<{ embedded?: boolean; id?: string }> = ({ embedded, id: propId }) => {
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, documents, currentDocument, setCurrentDocument, chatMessages, updateDocumentInList } = useStudy();

  const initialTab = (location.state as any)?.activeTab ?? 'summary';
  const [activeTab, setActiveTab] = useState<'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat'>(initialTab);
  const [activeView, setActiveView] = useState<'study' | 'article'>('article');

  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryStreamText, setSummaryStreamText] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [noteContent, setNoteContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const [toolbar, setToolbar] = useState<{ x: number; y: number; text: string } | null>(null);
  const [summaryToolbar, setSummaryToolbar] = useState<{ x: number; y: number; text: string } | null>(null);

  const noteEditorRef = useRef<VideoNoteEditorRef>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [docChatMessages, setDocChatMessages] = useState<Array<{ id: string; role: 'user' | 'model'; content: string; isError?: boolean }>>([]);

  // ── Load document ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    const doc = documents.find(d => d.id === id);

    if (doc && currentDocument?.id !== id) {
      setCurrentDocument(doc);
    }

    // Fetch fresh data once the document's courseId is known
    const courseId = doc?.courseId ?? (location.state as any)?.courseId;
    if (courseId) {
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
        .catch(() => { });
    }
  }, [id, isLoading]);

  // ── Seed chat from context ─────────────────────────────────────────────────
  useEffect(() => {
    setDocChatMessages(chatMessages.map(m => ({ id: m.id, role: m.role as 'user' | 'model', content: m.content })));
  }, [currentDocument?.id, chatMessages]);

  // ── Load note ──────────────────────────────────────────────────────────────
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
      <div className={cn("flex items-center justify-center bg-[var(--bg-app)]", embedded ? "h-full" : "h-screen")}>
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
        ) : (
          <div className="text-center">
            <p className="text-text-muted">Article not found.</p>
            <button onClick={() => navigate('/summarizer')} className="mt-4 text-sm text-[var(--primary)] hover:underline">
              Back to Summarizer
            </button>
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
                  <DocumentQuiz />
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

      {/* ── Mobile bottom nav ── */}
      {!embedded && (
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
      )}

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
