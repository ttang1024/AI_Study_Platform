import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FileText, Sparkles, ChevronLeft, Share2, Highlighter } from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { DocumentViewer } from '../components/document/DocumentViewer';
import StaleSourceBanner from '../components/document/StaleSourceBanner';
import DocumentSourceView from '../components/document/DocumentSourceView';
import { AnnotatedPdfViewer } from '../components/AnnotatedPdfViewer';
import { ChatPanel, ChatPanelRef } from '../components/ai/ChatPanel';
import { ChatConversationBar } from '../components/ai/ChatConversationBar';
import { useDocumentChatThreads } from '../components/ai/useDocumentChatThreads';
import { MindMapViewer } from '../components/mindmap/MindMapViewer';
import { Flashcards } from '../components/study/Flashcards';
import { DocumentQuiz } from '../components/quiz/DocumentQuiz';
import { QuizModal } from '../components/quiz/QuizModal';
import { TextSelectionToolbar } from '../components/document/TextSelectionToolbar';
import { VideoNoteEditor, VideoNoteEditorRef } from '../components/youtube/VideoNoteEditor';
import { SummaryPanel } from '../components/study/SummaryPanel';
import { WorkedProblemsPanel } from '../components/WorkedProblemsPanel';
import { documentService, usesServerExtractedText } from '../services/documentService';
import { apiClient } from '../services/apiClient';
import { ShareModal } from '../components/common/ShareModal';
import { DetailPageSkeleton } from '../components/common/DetailPageSkeleton';
import { ShareableQuiz, ShareableCard } from '../services/shareContentService';
import { DOCUMENT_TABS } from '../constants/tab';
import { cn } from '../utils/cn';
import { Document } from '../types';
import { getApiErrorCode } from '../utils/apiError';
import { normalizeSummaryText } from '@core/utils/summary';
import { getApiUrl } from '../utils/env';
import { useStudyTimer } from '../hooks/useStudyTimer';

export const DocumentDetailsPage: React.FC<{ embedded?: boolean; id?: string; initialDoc?: Document }> = ({ embedded, id: propId, initialDoc }) => {
  const { id: paramId } = useParams();
  const id = propId ?? paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, documents, currentDocument, setCurrentDocument, updateDocumentInList, ensureDocuments } = useStudy();

  // The document list is loaded lazily by StudyContext; pull it so we can resolve
  // this document (and its courseId) on direct navigation / refresh.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);
  // A citation links here as ?highlight=start-end. Parsed before the initial tab is chosen so
  // arriving from one opens straight onto the passage rather than the summary.
  const citationHighlight = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('highlight');
    if (!raw) return null;

    const [start, end] = raw.split('-').map(Number);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
  }, [location.search]);

  const initialTab = citationHighlight ? 'source' : ((location.state as any)?.activeTab ?? 'summary');
  const targetQuizQuestionId = (location.state as any)?.targetQuizQuestionId as string | undefined;
  const [activeTab, setActiveTab] = useState<'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat' | 'source'>(initialTab);
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

  // Tracks the document id we've already fetched fresh data for, so re-running
  // this effect (e.g. after updateDocumentInList changes the documents list)
  // doesn't refetch the same document in a loop.
  const fetchedDocIdRef = useRef<string | null>(null);

  // Ref to note editor for append-from-outside
  const noteEditorRef = useRef<VideoNoteEditorRef>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);

  // Chat threads (multiple conversations per document)
  const docChat = useDocumentChatThreads(currentDocument?.courseId, currentDocument?.id);

  // Attribute reading/quizzing time on this document to its course in analytics.
  useStudyTimer({
    contextType: 'document',
    courseId: currentDocument?.courseId,
    contextId: currentDocument?.id,
    enabled: !!currentDocument && currentDocument.id === id,
  });

  // Set current document on navigation and fetch fresh data for latest AI-generated content
  useEffect(() => {
    if (!id) return;

    const doc = documents.find(d => d.id === id) ?? initialDoc;

    // Set from the loaded list when navigating or when documents finish loading
    if (doc && currentDocument?.id !== id) {
      setCurrentDocument(doc);
    }

    // Fetch fresh data from API once the doc is found in the list — but only
    // once per document id. updateDocumentInList below mutates the documents
    // list reference, which re-runs this effect; without this guard that would
    // refetch endlessly.
    if (doc?.courseId && fetchedDocIdRef.current !== id) {
      fetchedDocIdRef.current = id;
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
  }, [id, isLoading, documents]); // re-run once the lazily-loaded list arrives so the doc resolves

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

  // Initialize summary from saved document data (also re-runs when fresh API data arrives)
  useEffect(() => {
    if (!currentDocument) return;

    setSummaryError(null);
    setSummary(normalizeSummaryText(currentDocument.summary));
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


  const handleSaveSummary = useCallback(async (markdown: string) => {
    if (!currentDocument) return;
    await documentService.updateSummary(currentDocument.courseId || '', currentDocument.id, markdown);
    setSummary(markdown);
    const updated = { ...currentDocument, summary: markdown };
    setCurrentDocument(updated);
    updateDocumentInList(updated);
  }, [currentDocument, setCurrentDocument, updateDocumentInList]);

  const handleSaveMindMap = useCallback(async (text: string) => {
    if (!currentDocument) return;
    await documentService.updateMindMap(currentDocument.courseId || '', currentDocument.id, text);
    const updated = { ...currentDocument, mindMapText: text };
    setCurrentDocument(updated);
    updateDocumentInList(updated);
  }, [currentDocument, setCurrentDocument, updateDocumentInList]);

  const [activeView, setActiveView] = useState<'study' | 'document'>('document');
  const [markupMode, setMarkupMode] = useState(false);

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

  const API_URL = getApiUrl();
  const token = localStorage.getItem('sp_access_token');
  const authHeaders = useMemo(
    () => token ? { Authorization: `Bearer ${token}` } : undefined,
    [token]
  );

  // For real documents, stream through the API to avoid CORS issues with blob storage.
  // For the mock document (id === '123'), use the direct public URL.
  // PPTX/EPUB/Office/eBook-style formats cannot be rendered raw in the browser,
  // so the viewer reads the server-extracted plain text instead of the original file.
  const usesExtractedText = currentDocument != null && usesServerExtractedText(currentDocument);
  const viewUrl = currentDocument?.courseId
    ? `${API_URL}/api/courses/${currentDocument.courseId}/documents/${currentDocument.id}/${usesExtractedText ? 'text' : 'file'}`
    : currentDocument?.url ?? '';

  if (!currentDocument) {
    return (
      <div className={cn("bg-[var(--bg-app)]", embedded ? "h-full" : "h-screen")}>
        {isLoading ? <DetailPageSkeleton variant="document" embedded={embedded} /> : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-text-muted">Document not found.</p>
              <button onClick={() => navigate('/library')} className="mt-4 text-sm text-[var(--primary)] hover:underline">
                Back to Library
              </button>
            </div>
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
          "relative flex-1 overflow-hidden transition-opacity duration-300",
          activeView === 'document' ? "opacity-100" : "opacity-0 lg:opacity-100"
        )}>
          {currentDocument.type === 'pdf' && markupMode ? (
            <AnnotatedPdfViewer
              key={currentDocument.id}
              documentId={currentDocument.id}
              pdfUrl={viewUrl}
              httpHeaders={authHeaders}
            />
          ) : (
            <DocumentViewer
              key={currentDocument.id}
              fileUrl={viewUrl}
              fileType={currentDocument.type as 'pdf' | 'docx' | 'txt' | 'md' | 'image' | 'ppt' | 'epub'}
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
          )}

          {/* Markup toggle (PDF only) */}
          {currentDocument.type === 'pdf' && (
            <button
              onClick={() => setMarkupMode((m) => !m)}
              title={markupMode ? 'Exit markup mode' : 'Mark up PDF (highlight & annotate)'}
              className={cn(
                "absolute top-3 right-3 z-30 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all",
                markupMode
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border-color)] bg-white/90 text-text-muted hover:border-primary/30 hover:text-primary"
              )}
            >
              <Highlighter size={14} />
              <span>{markupMode ? 'Markup on' : 'Markup'}</span>
            </button>
          )}
        </div>

        {/* Right Panel - Study Tools */}
        <div className={cn(
          "absolute inset-0 z-20 bg-[var(--bg-app)] lg:relative lg:flex lg:flex-1 lg:border-l lg:border-[var(--border-color)] lg:bg-[var(--bg-sidebar)] transition-transform duration-300 lg:translate-x-0",
          activeView === 'study' ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}>
          <div className="flex flex-col h-full w-full">
            {/* Horizontal Tab Bar */}
            <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-x-auto no-scrollbar">
              {DOCUMENT_TABS.map((tab) => (
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

              {/* Above the tabs' content, not inside one: a replaced source invalidates every kind
                  of generated material, so the warning belongs to the document, not to a tab. */}
              {id && (
                <div className="px-4 pt-4">
                  <StaleSourceBanner documentId={id} />
                </div>
              )}

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
                    onSaveSummary={handleSaveSummary}
                  />
                </div>

                <div className={cn("h-full", activeTab !== 'mindmap' && "hidden")}>
                  <MindMapViewer onSaveEdit={handleSaveMindMap} />
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
                  <Flashcards documentId={currentDocument.id} />
                </div>

                <div className={cn("h-full", activeTab !== 'quiz' && "hidden")}>
                  <DocumentQuiz targetQuestionId={targetQuizQuestionId} />
                </div>

                <div className={cn("h-full overflow-y-auto no-scrollbar", activeTab !== 'problems' && "hidden")}>
                  {currentDocument.courseId && (
                    <WorkedProblemsPanel documentId={currentDocument.id} />
                  )}
                </div>

                <div className={cn("h-full overflow-y-auto no-scrollbar", activeTab !== 'source' && "hidden")}>
                  <DocumentSourceView documentId={currentDocument.id} highlight={citationHighlight} />
                </div>


              </div>

              <div className={cn("flex-1 overflow-hidden flex flex-col", activeTab !== 'chat' && "hidden")}>
                <ChatConversationBar
                  conversations={docChat.conversations}
                  activeId={docChat.activeConversationId}
                  onSelect={docChat.selectConversation}
                  onNew={docChat.newConversation}
                  onDelete={docChat.deleteConversation}
                />
                <div className="flex-1 overflow-hidden">
                  <ChatPanel
                    ref={chatPanelRef}
                    onTabChange={setActiveTab}
                    externalMessages={docChat.messages}
                    enableAttachments
                    onExternalStreamSend={docChat.streamChat}
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


      </div>

      {/* Mobile Bottom Navigation */}
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
        fetchQuizzes={currentDocument.courseId && shareQuizzesAvailable ? async () => {
          const qs = shareQuizzesRef.current ?? await documentService.getQuiz(currentDocument.courseId!, currentDocument.id);
          return qs.map((q) => ({
            question: q.question,
            options: q.options ?? [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation ?? '',
            difficulty: q.difficulty ?? 'medium',
          } satisfies ShareableQuiz));
        } : undefined}
        fetchFlashcards={currentDocument.courseId ? async () => {
          const res = await apiClient.get<{ data: ShareableCard[] }>(`/api/courses/${currentDocument.courseId}/documents/${currentDocument.id}/flashcards`);
          return res.data.data.map(f => ({ front: f.front, back: f.back, cardType: f.cardType }));
        } : undefined}
      />
    </div>
  );
};
