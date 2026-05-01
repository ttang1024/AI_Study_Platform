import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Mic, Rss, Sparkles, Loader2, ChevronLeft, AlertCircle, FileText, Copy, Download, RotateCcw, Share2,
} from 'lucide-react';
import { ShareModal } from '../components/common/ShareModal';
import { ShareableQuiz, ShareableCard } from '../services/shareContentService';
import { documentService } from '../services/documentService';
import { audioService } from '../services/audioService';
import { VideoNoteEditor, VideoNoteEditorRef } from '../components/youtube/VideoNoteEditor';
import { MindMapViewer } from '../components/mindmap/MindMapViewer';
import { Flashcards } from '../components/study/Flashcards';
import { DocumentQuiz } from '../components/quiz/DocumentQuiz';
import { ChatPanel, ChatPanelRef } from '../components/ai/ChatPanel';
import { SummaryPanel } from '../components/study/SummaryPanel';
import { cn } from '../utils/cn';
import { TABS } from '../constants/tab';
import { QuizQuestion } from '../types';
import { useStudy } from '../context/StudyContext';

interface SimpleCard { id: string; front: string; back: string; }
interface ChatMsg { id: string; role: 'user' | 'model'; content: string; isError?: boolean; }
interface TranscriptSegment { start: number; end: number; text: string; }

function parseTranscript(raw: string | null): TranscriptSegment[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && 'start' in parsed[0]) return parsed;
  } catch { }
  return null; // plain text — caller handles it
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Segmented transcript component ──────────────────────────────────────────

interface SegmentedTranscriptProps {
  transcript: string;
  currentTime: number;
  activeSegmentRef: React.RefObject<HTMLDivElement | null>;
  onSeek: (time: number) => void;
}

const SegmentedTranscript: React.FC<SegmentedTranscriptProps> = ({
  transcript, currentTime, activeSegmentRef, onSeek,
}) => {
  const segments = parseTranscript(transcript);

  // Plain text fallback (old transcripts stored without timestamps)
  if (!segments) {
    return (
      <div className="px-6 py-5">
        <p className="text-sm text-text-main leading-relaxed whitespace-pre-wrap select-text">{transcript}</p>
      </div>
    );
  }

  const activeIdx = segments.findLastIndex(s => currentTime >= s.start);

  return (
    <div className="flex flex-col divide-y divide-[var(--border-color)]">
      {segments.map((seg, i) => {
        const isActive = i === activeIdx;
        return (
          <div
            key={i}
            ref={isActive ? activeSegmentRef : undefined}
            onClick={() => onSeek(seg.start)}
            className={cn(
              'flex gap-3 px-5 py-3.5 cursor-pointer transition-colors duration-150 group',
              isActive
                ? 'bg-[var(--primary)]/8'
                : 'hover:bg-zinc-50',
            )}
          >
            <span className={cn(
              'shrink-0 mt-0.5 text-[11px] font-mono font-bold tabular-nums pt-px',
              isActive ? 'text-[var(--primary)]' : 'text-text-muted group-hover:text-text-main',
            )}>
              {formatTime(seg.start)}
            </span>
            <p className={cn(
              'text-sm leading-relaxed select-text',
              isActive ? 'text-text-main font-medium' : 'text-text-muted group-hover:text-text-main',
            )}>
              {seg.text}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const AudioDetailPage: React.FC<{ embedded?: boolean; id?: string }> = ({ embedded, id: propId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId ?? paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const { documents } = useStudy();

  // courseId from nav state OR documents context
  const navCourseId = (location.state as any)?.courseId as string | undefined;
  const [courseId, setCourseId] = useState<string>(navCourseId ?? '');

  const [fileName, setFileName] = useState<string | null>(null);
  const [isPodcast, setIsPodcast] = useState(false);
  const [podcastOriginalUrl, setPodcastOriginalUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript to active segment
  useEffect(() => {
    activeSegmentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [Math.floor(currentTime / 30)]);

  // Transcript
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  // Transcript copy/download menus
  const [openMenu, setOpenMenu] = useState<'copy' | 'download' | null>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Layout
  const initialTab = (location.state as any)?.activeTab ?? 'summary';
  const [activeTab, setActiveTab] = useState<'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'chat'>(initialTab);
  const [activeView, setActiveView] = useState<'study' | 'audio'>('audio');

  // Summary
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryStreamText, setSummaryStreamText] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // MindMap
  const [mindMapText, setMindMapText] = useState<string | null>(null);
  const [isLoadingMindMap, setIsLoadingMindMap] = useState(false);
  const [mindMapStreamingText, setMindMapStreamingText] = useState<string | null>(null);
  const [mindMapError, setMindMapError] = useState<string | null>(null);

  // Share
  const [showShareModal, setShowShareModal] = useState(false);

  // Notes
  const [noteContent, setNoteContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const noteEditorRef = useRef<VideoNoteEditorRef>(null);

  // Flashcards
  const [flashcards, setFlashcards] = useState<SimpleCard[]>([]);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const chatPanelRef = useRef<ChatPanelRef>(null);

  // Click-outside to close transcript menus
  useEffect(() => {
    if (!openMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (copyMenuRef.current?.contains(target) || downloadMenuRef.current?.contains(target)) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  // ─── Load audio on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    // Try to resolve courseId from documents context if not in nav state
    const ctxDoc = documents.find(d => d.id === id);
    const resolvedCourseId = navCourseId ?? ctxDoc?.courseId ?? '';
    if (resolvedCourseId) setCourseId(resolvedCourseId);
    loadAudio(resolvedCourseId, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadAudio = async (cId: string, docId: string) => {
    setIsLoadingPage(true);
    try {
      const doc = await audioService.getAudio(cId, docId);
      setFileName(doc.fileName);
      setIsPodcast(doc.contentType === 'audio/podcast');
      setPodcastOriginalUrl(doc.originalUrl ?? null);
      setSummary(doc.summary ?? null);
      setMindMapText(doc.mindMapText ?? null);
      setTranscript(doc.transcript ?? null);

      // Auto-transcribe if no transcript yet
      if (!doc.transcript) {
        doTranscribe(cId, docId);
      }

      const sasUrl = await audioService.getAudioUrl(cId, docId);
      setAudioUrl(sasUrl);

      // Load saved notes
      try {
        const notes = await documentService.getNotes(cId, docId);
        if (notes.length > 0) { setNoteContent(notes[0].content); setNoteId(notes[0].id); }
      } catch { }

      // Load flashcards
      try {
        const cards = await documentService.getFlashcards(cId, docId);
        setFlashcards(cards.map((c, i) => ({ id: `fc-${i}`, front: c.front, back: c.back })));
      } catch { }

      // Load quiz
      try {
        const questions = await documentService.getQuiz(cId, docId);
        setQuizQuestions(questions);
      } catch { }

      // Load quiz submission
      try {
        const sub = await documentService.getQuizSubmission(cId, docId);
        if (sub) { setUserAnswers(sub.answers); setQuizScore(sub.score); setIsQuizSubmitted(true); }
      } catch { }

      // Load chat
      try {
        const history = await documentService.getChatHistory(cId, docId);
        setChatMessages(history.map(m => ({ id: m.id, role: m.role as 'user' | 'model', content: m.content })));
      } catch { }
    } catch {
      navigate(-1);
    } finally {
      setIsLoadingPage(false);
    }
  };

  // ─── Transcribe ────────────────────────────────────────────────────────────

  const doTranscribe = async (cId: string, docId: string) => {
    setIsTranscribing(true);
    setTranscriptError(null);
    try {
      const doc = await audioService.transcribe(cId, docId);
      setTranscript(doc.transcript ?? null);
    } catch (err: any) {
      setTranscriptError(err?.response?.data?.message ?? 'Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranscribe = () => {
    if (!id || !courseId || isTranscribing) return;
    doTranscribe(courseId, id);
  };

  // ─── Transcript helpers ─────────────────────────────────────────────────────

  const fmtSrtTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  const getTranscriptPlainText = (withTimestamp: boolean): string => {
    if (!transcript) return '';
    const segs = parseTranscript(transcript);
    if (!segs) return transcript;
    return withTimestamp
      ? segs.map(s => `[${formatTime(s.start)}] ${s.text}`).join('\n')
      : segs.map(s => s.text).join(' ');
  };

  const getTranscriptSrt = (withTimestamp: boolean): string => {
    if (!transcript) return '';
    const segs = parseTranscript(transcript);
    if (!segs) return transcript;
    return segs.map((seg, i) => {
      const end = segs[i + 1]?.start ?? seg.end ?? seg.start + 5;
      return withTimestamp
        ? `${i + 1}\n${fmtSrtTime(seg.start)} --> ${fmtSrtTime(end)}\n${seg.text}`
        : `${i + 1}\n${seg.text}`;
    }).join('\n\n');
  };

  const copyTranscript = (withTimestamp: boolean) => {
    navigator.clipboard.writeText(getTranscriptPlainText(withTimestamp));
    setOpenMenu(null);
  };

  const downloadTranscript = (format: 'txt' | 'srt', withTimestamp: boolean) => {
    const content = format === 'srt' ? getTranscriptSrt(withTimestamp) : getTranscriptPlainText(withTimestamp);
    const suffix = withTimestamp ? '_timestamps' : '';
    const base = (fileName ?? 'transcript').replace(/[^a-z0-9_\-]/gi, '_');
    const filename = `${base}${suffix}.${format}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setOpenMenu(null);
  };

  // ─── Summary ───────────────────────────────────────────────────────────────

  const generateSummary = useCallback(async () => {
    if (!id || !courseId || isLoadingSummary) return;
    setSummaryError(null);
    setIsLoadingSummary(true);
    setSummaryStreamText('');
    try {
      let accumulated = '';
      await documentService.streamSummary(courseId, id, (chunk) => {
        accumulated += chunk;
        setSummaryStreamText(accumulated);
      });
      setSummary(accumulated || null);
      setSummaryStreamText('');
    } catch (err: any) {
      setSummaryError(err?.message ?? 'Failed to generate summary.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, [id, courseId, isLoadingSummary]);

  // ─── Mind Map ──────────────────────────────────────────────────────────────

  const generateMindMap = useCallback(async () => {
    if (!id || !courseId || isLoadingMindMap) return;
    setMindMapError(null);
    setIsLoadingMindMap(true);
    setMindMapStreamingText('');
    const accum = { current: '' };
    try {
      await documentService.streamMindMap(courseId, id, (chunk) => {
        accum.current += chunk;
        setMindMapStreamingText(accum.current);
      });
      setMindMapText(accum.current || null);
      setMindMapStreamingText(null);
    } catch (err: any) {
      setMindMapStreamingText(null);
      setMindMapError(err?.message ?? 'Failed to generate mind map.');
    } finally {
      setIsLoadingMindMap(false);
    }
  }, [id, courseId, isLoadingMindMap]);

  // ─── Flashcards ────────────────────────────────────────────────────────────

  const generateFlashcards = useCallback(async () => {
    if (!id || !courseId || isLoadingFlashcards) return;
    setFlashcardsError(null);
    setIsLoadingFlashcards(true);
    try {
      const cards = await documentService.generateFlashcards(courseId, id);
      setFlashcards(cards.map((c, i) => ({ id: `fc-${i}`, front: c.front, back: c.back })));
    } catch (err: any) {
      setFlashcardsError(err?.message ?? 'Failed to generate flashcards.');
    } finally {
      setIsLoadingFlashcards(false);
    }
  }, [id, courseId, isLoadingFlashcards]);

  // ─── Quiz ──────────────────────────────────────────────────────────────────

  const generateQuiz = useCallback(async () => {
    if (!id || !courseId || isLoadingQuiz) return;
    setQuizError(null);
    setIsLoadingQuiz(true);
    setQuizQuestions([]);
    setUserAnswers({});
    setIsQuizSubmitted(false);
    setQuizScore(0);
    try {
      const questions = await documentService.generateQuiz(courseId, id);
      setQuizQuestions(questions);
    } catch (err: any) {
      setQuizError(err?.message ?? 'Failed to generate quiz.');
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [id, courseId, isLoadingQuiz]);

  const submitQuiz = useCallback(async () => {
    let score = 0;
    quizQuestions.forEach(q => {
      if (userAnswers[q.id]) {
        const selected = userAnswers[q.id].charAt(0).toUpperCase();
        const correct = q.answer.charAt(0).toUpperCase();
        if (selected === correct) score++;
      }
    });
    setQuizScore(score);
    setIsQuizSubmitted(true);
    if (id && courseId) {
      try { await documentService.saveQuizSubmission(courseId, id, userAnswers, score, quizQuestions.length); } catch { }
    }
  }, [quizQuestions, userAnswers, id, courseId]);

  // ─── Notes ─────────────────────────────────────────────────────────────────

  const handleNoteSave = useCallback(async (html: string) => {
    setNoteContent(html);
    if (!id || !courseId) return;
    try {
      if (noteId) {
        await documentService.updateNote(courseId, id, noteId, html);
      } else {
        const note = await documentService.createNote(courseId, id, html);
        setNoteId(note.id);
      }
    } catch { }
  }, [id, courseId, noteId]);

  // ─── Study Panel ───────────────────────────────────────────────────────────

  const studyPanel =
    <div className="flex flex-col h-full w-full">
      {/* Horizontal Tab Bar */}
      <div className="flex items-center border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
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
              isLoading={isLoadingSummary}
              onGenerate={generateSummary}
              loadingText={isPodcast ? 'AI is analyzing the podcast…' : 'AI is analyzing the audio…'}
              emptyText={isPodcast ? 'Generate an AI summary of this episode.' : 'Generate an AI summary of this lecture.'}
              error={summaryError}
              onRetry={generateSummary}
              streamingText={summaryStreamText}
            />
          </div>

          <div className={cn('h-full', activeTab !== 'mindmap' && 'hidden')}>
            <MindMapViewer
              mindMapText={mindMapText}
              onGenerate={generateMindMap}
              isGenerating={isLoadingMindMap}
              streamingText={mindMapStreamingText}
              externalError={mindMapError}
              title={fileName ?? 'mindmap'}
            />
          </div>

          <div className={cn('h-full relative', activeTab !== 'notes' && 'hidden')}>
            {id ? (
              <VideoNoteEditor
                ref={noteEditorRef}
                videoRecordId={id}
                initialContent={noteContent}
                onSave={handleNoteSave}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                Load an audio file to start taking notes.
              </div>
            )}
          </div>

          <div className={cn('h-full', activeTab !== 'flashcards' && 'hidden')}>
            <Flashcards
              externalCards={flashcards}
              onExternalGenerate={generateFlashcards}
              isExternalGenerating={isLoadingFlashcards}
              externalError={flashcardsError}
            />
          </div>

          <div className={cn('h-full overflow-y-auto', activeTab !== 'quiz' && 'hidden')}>
            <DocumentQuiz
              externalQuestions={quizQuestions}
              externalUserAnswers={userAnswers}
              externalSubmitted={isQuizSubmitted}
              externalScore={quizScore}
              isExternalLoading={isLoadingQuiz}
              externalError={quizError}
              onExternalGenerate={generateQuiz}
              onExternalAnswer={(qId, option) => {
                if (!isQuizSubmitted) setUserAnswers(prev => ({ ...prev, [qId]: option }));
              }}
              onExternalSubmit={submitQuiz}
            />
          </div>

          <div className={cn('flex-1 overflow-hidden', activeTab !== 'chat' && 'hidden')}>
            <ChatPanel
              ref={chatPanelRef}
              externalMessages={chatMessages}
              onExternalStreamSend={async (message, onChunk) => {
                if (!id || !courseId) return;
                const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: message };
                setChatMessages(prev => [...prev, userMsg]);
                let accumulated = '';
                await documentService.streamChat(courseId, id, message, (chunk) => {
                  accumulated += chunk;
                  onChunk(chunk);
                });
                setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: accumulated }]);
              }}
              onExternalAddToNote={(html) => {
                noteEditorRef.current?.appendContent(html);
                setActiveTab('notes');
              }}
              placeholder="Ask anything about the lecture…"
            />
          </div>
        </div>
      </div>
    </div>


  if (isLoadingPage) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-[var(--bg-app)] overflow-hidden", embedded ? "h-full" : "h-screen")}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Header */}
        {!embedded && (
          <div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0', isPodcast ? 'bg-amber-500' : 'bg-[var(--primary)]')}>
              {isPodcast ? <Rss size={14} /> : <Mic size={14} />}
            </div>
            <p className="flex-1 min-w-0 text-xs font-medium text-text-main truncate">
              {fileName ?? (isPodcast ? 'Podcast Episode' : 'Audio Lecture')}
            </p>
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted border border-[var(--border-color)] hover:border-primary/50 hover:text-primary transition-all shrink-0"
            >
              <Share2 size={13} /> Share
            </button>
          </div>
        )}

        {/* 3-panel layout */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left – Audio Player + Transcript */}
          <div className={cn(
            'flex-1 flex flex-col overflow-hidden transition-opacity duration-300',
            activeView === 'audio' ? 'opacity-100' : 'opacity-0 lg:opacity-100',
          )}>
            {/* Audio Player */}
            <div className="shrink-0 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl shrink-0', isPodcast ? 'bg-amber-100 text-amber-500' : 'bg-[var(--primary)]/10 text-[var(--primary)]')}>
                  {isPodcast ? <Rss size={24} /> : <Mic size={24} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-main truncate">{fileName ?? (isPodcast ? 'Podcast Episode' : 'Audio Lecture')}</p>
                  <p className="text-xs text-text-muted mt-0.5">{isPodcast ? 'Podcast Episode' : 'Audio Lecture'}</p>
                </div>
              </div>
              {audioUrl ? (
                <audio
                  ref={audioRef}
                  controls
                  src={audioUrl}
                  className="w-full h-10 rounded-xl"
                  style={{ accentColor: 'var(--primary)' }}
                  onTimeUpdate={e => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
                >
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="flex items-center justify-center h-10 rounded-xl bg-zinc-100 text-xs text-text-muted">
                  <Loader2 size={14} className="animate-spin mr-2" /> Loading audio…
                </div>
              )}
            </div>

            {/* Transcript */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center justify-between px-5 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-sidebar)]">
                <div className="flex items-center gap-1">
                  <span className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] border-b-2 border-[var(--primary)] text-[var(--primary)]">
                    Transcript
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {transcript && (
                    <>
                      {/* Copy dropdown */}
                      <div className="relative" ref={copyMenuRef}>
                        <button
                          onClick={() => setOpenMenu(openMenu === 'copy' ? null : 'copy')}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors"
                        >
                          <Copy size={11} /> Copy
                        </button>
                        {openMenu === 'copy' && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] rounded-lg border border-[var(--border-color)] bg-white shadow-lg overflow-hidden">
                            <button onClick={() => copyTranscript(true)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              Copy with timestamp
                            </button>
                            <button onClick={() => copyTranscript(false)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              Copy without timestamp
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Download dropdown */}
                      <div className="relative" ref={downloadMenuRef}>
                        <button
                          onClick={() => setOpenMenu(openMenu === 'download' ? null : 'download')}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors"
                        >
                          <Download size={11} /> Download
                        </button>
                        {openMenu === 'download' && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-lg border border-[var(--border-color)] bg-white shadow-lg overflow-hidden">
                            <button onClick={() => downloadTranscript('txt', true)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              TXT with timestamps
                            </button>
                            <button onClick={() => downloadTranscript('txt', false)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              TXT without timestamps
                            </button>
                            <button onClick={() => downloadTranscript('srt', true)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              SRT with timestamps
                            </button>
                            <button onClick={() => downloadTranscript('srt', false)} className="w-full px-3 py-2 text-left text-[11px] text-text-main hover:bg-zinc-50 transition-colors">
                              SRT without timestamps
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Refresh */}
                      <button onClick={handleTranscribe} disabled={isTranscribing} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
                        <RotateCcw size={11} className={isTranscribing ? 'animate-spin' : ''} /> Refresh
                      </button>
                    </>
                  )}
                  {!transcript && transcriptError && (
                    <button onClick={handleTranscribe} disabled={isTranscribing} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
                      <RotateCcw size={11} className={isTranscribing ? 'animate-spin' : ''} /> Retry
                    </button>
                  )}
                </div>
              </div>

              {/* Transcript content */}
              <div className="flex-1 overflow-y-auto">
                {isTranscribing ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
                    <p className="text-xs text-zinc-400">{isPodcast ? 'Transcribing podcast…' : 'Transcribing audio…'}</p>
                    <p className="text-[11px] text-zinc-300">This may take a moment for longer recordings.</p>
                  </div>
                ) : transcript ? (
                  <SegmentedTranscript
                    transcript={transcript}
                    currentTime={currentTime}
                    activeSegmentRef={activeSegmentRef}
                    onSeek={t => { if (audioRef.current) { audioRef.current.currentTime = t; audioRef.current.play(); } }}
                  />
                ) : transcriptError ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-main">Transcription failed</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{transcriptError}</p>
                    </div>
                    <button
                      onClick={handleTranscribe}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
                    >
                      <RotateCcw size={11} /> Try Again
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
                    <p className="text-xs text-zinc-400">Preparing transcription…</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right – Study Tools */}
          <div className={cn(
            'absolute inset-0 z-20 bg-[var(--bg-app)] lg:relative lg:flex lg:flex-1 lg:border-l lg:border-[var(--border-color)] lg:bg-[var(--bg-sidebar)] transition-transform duration-300 lg:translate-x-0',
            activeView === 'study' ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
          )}>
            {studyPanel}
          </div>

        </div>

        {/* Mobile Bottom Nav */}
        {!embedded && (
          <div className="flex h-16 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:hidden shrink-0">
            <button onClick={() => setActiveView('study')} className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'study' ? 'text-[var(--primary)]' : 'text-text-muted')}>
              <Sparkles size={20} /><span className="text-[10px] font-bold uppercase tracking-wider">Study</span>
            </button>
            <button onClick={() => setActiveView('audio')} className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'audio' ? 'text-[var(--primary)]' : 'text-text-muted')}>
              {isPodcast ? <Rss size={20} /> : <Mic size={20} />}
              <span className="text-[10px] font-bold uppercase tracking-wider">{isPodcast ? 'Podcast' : 'Audio'}</span>
            </button>
          </div>
        )}
      </motion.div>

      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={fileName ?? 'Audio Lecture'}
        summary={summary}
        mindMapText={mindMapText}
        notesHtml={noteContent || null}
        sourceType={isPodcast ? 'podcast' : 'audio'}
        sourceUrl={courseId && id ? `${courseId}/${id}` : null}
        originalArticleUrl={isPodcast ? podcastOriginalUrl : null}
        fetchQuizzes={quizQuestions.length > 0 ? async () =>
          quizQuestions.map(q => ({
            question: q.question,
            options: q.options ?? [],
            correctAnswer: q.answer,
            explanation: q.explanation ?? '',
          } satisfies ShareableQuiz))
          : undefined}
        fetchFlashcards={flashcards.length > 0 ? async () =>
          flashcards.map(c => ({ front: c.front, back: c.back } satisfies ShareableCard))
          : undefined}
      />
    </div>
  );
};
