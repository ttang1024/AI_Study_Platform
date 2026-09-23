import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useStudy } from '../../context/StudyContext';
import { documentService } from '../../services/documentService';
import { useDocumentChatThreads } from '../../components/ai/useDocumentChatThreads';
import { audioService } from '../../services/audioService';
import { VideoNoteEditorRef } from '../../components/youtube/VideoNoteEditor';
import { ChatPanelRef } from '../../components/ai/ChatPanel';
import { getApiErrorCode } from '@core/utils/apiError';
import { useSelectionToolbar } from '../../hooks/useSelectionToolbar';
import { useDocumentNote } from '../../hooks/useDocumentNote';
import { useDifficultyQuiz, type QuizDifficulty } from '../../hooks/useDifficultyQuiz';
import { buildSrt } from '@core/utils/format';
import { parseTranscript, formatTime } from './transcript';

export interface SimpleCard { id: string; front: string; back: string; cardType?: 'basic' | 'cloze' | 'chart' | 'occlusion'; }
export type AudioStudyTab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat';

/** All state, data loading and study-action handlers for the audio/podcast detail page. */
export function useAudioDetail(propId?: string, propCourseId?: string) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId ?? paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const { documents, isLoading, ensureDocuments } = useStudy();

  // The document list is loaded lazily by StudyContext; pull it so we can resolve
  // this audio item's courseId on direct navigation / refresh.
  useEffect(() => { void ensureDocuments(); }, [ensureDocuments]);
  const loadedKeyRef = useRef('');

  // courseId priority: prop > nav state > documents context
  const navCourseId = (location.state as any)?.courseId as string | undefined;
  const [courseId, setCourseId] = useState<string>(propCourseId ?? navCourseId ?? '');

  const [fileName, setFileName] = useState<string | null>(null);
  const [isPodcast, setIsPodcast] = useState(false);
  const [podcastOriginalUrl, setPodcastOriginalUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
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

  // Layout
  const initialTab = (location.state as any)?.activeTab ?? 'summary';
  const targetQuizQuestionId = (location.state as any)?.targetQuizQuestionId as string | undefined;
  const [activeTab, setActiveTab] = useState<AudioStudyTab>(initialTab);
  const [activeView, setActiveView] = useState<'study' | 'audio'>('audio');

  // Summary
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryStreamText, setSummaryStreamText] = useState('');
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const { toolbar: summaryToolbar, setToolbar: setSummaryToolbar, onMouseUp: handleSummaryMouseUp } = useSelectionToolbar();

  // MindMap
  const [mindMapText, setMindMapText] = useState<string | null>(null);
  const [isLoadingMindMap, setIsLoadingMindMap] = useState(false);
  const [mindMapStreamingText, setMindMapStreamingText] = useState<string | null>(null);
  const [mindMapError, setMindMapError] = useState<string | null>(null);

  // Share
  const [showShareModal, setShowShareModal] = useState(false);

  // Notes
  const noteEditorRef = useRef<VideoNoteEditorRef>(null);

  // Flashcards
  const [flashcards, setFlashcards] = useState<SimpleCard[]>([]);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);

  // Chat — multiple conversations (threads), shared with document/article pages
  const docChat = useDocumentChatThreads(courseId || null, id || null);
  const { noteContent, saveNote } = useDocumentNote(courseId || undefined, id);
  const chatPanelRef = useRef<ChatPanelRef>(null);

  useEffect(() => () => {
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
  }, []);

  // ─── Load audio on mount ───────────────────────────────────────────────────

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

      // Kick off transcription automatically when none exists yet; the
      // isTranscribing/transcriptError UI states cover progress and failure.
      if (!doc.transcript) void doTranscribe(cId, docId);

      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }

      // Independent reads (audio URL resolution, notes, flashcards, quiz, quiz submission)
      // fire together instead of one-at-a-time.
      const isPodcastDoc = doc.contentType === 'audio/podcast';
      const [resolvedAudioUrl, cards, questions, sub] = await Promise.all([
        isPodcastDoc ? audioService.getAudioUrl(cId, docId) : audioService.getAudioBlobUrl(cId, docId),
        documentService.getFlashcards(cId, docId).catch(() => null),
        documentService.getQuiz(cId, docId).catch(() => null),
        documentService.getQuizSubmission(cId, docId).catch(() => null),
      ]);

      if (isPodcastDoc) {
        setAudioUrl(resolvedAudioUrl);
      } else {
        audioObjectUrlRef.current = resolvedAudioUrl;
        setAudioUrl(resolvedAudioUrl);
      }

      if (cards) {
        setFlashcards(cards.map(c => ({ id: c.id, front: c.front, back: c.back, cardType: c.cardType })));
      }

      quiz.applyLoadedQuiz(questions, sub);

    } catch {
      navigate(-1);
    } finally {
      setIsLoadingPage(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const ctxDoc = documents.find(d => d.id === id);
    const resolvedCourseId = propCourseId ?? navCourseId ?? ctxDoc?.courseId ?? '';
    if (!resolvedCourseId) return;
    const loadKey = `${id}:${resolvedCourseId}`;
    if (loadedKeyRef.current === loadKey) return;
    loadedKeyRef.current = loadKey;
    setCourseId(resolvedCourseId);
    loadAudio(resolvedCourseId, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isLoading, documents]);

  // ─── Transcribe ────────────────────────────────────────────────────────────

  const doTranscribe = async (cId: string, docId: string) => {
    setIsTranscribing(true);
    setTranscriptError(null);
    try {
      const doc = await audioService.transcribe(cId, docId);
      if (doc.transcript) {
        setTranscript(doc.transcript);
        return;
      }

      const maxAttempts = 180;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const latest = await audioService.getAudio(cId, docId);
        if (latest.transcript) {
          setTranscript(latest.transcript);
          setSummary(latest.summary ?? null);
          setMindMapText(latest.mindMapText ?? null);
          return;
        }
      }

      throw new Error('Transcription is still running. Check again in a few minutes.');
    } catch (err: any) {
      setTranscriptError(err?.response?.data?.message ?? err?.message ?? 'Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranscribe = () => {
    if (!id || !courseId || isTranscribing) return;
    doTranscribe(courseId, id);
  };

  const seekAudioTo = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    audioRef.current.play();
  }, []);

  const generationDisabled = !transcript && !transcriptError;
  const generationDisabledReason = isPodcast
    ? 'Transcribe the podcast before generating study materials.'
    : 'Transcribe the audio before generating study materials.';

  const generateQuizQuestions = useCallback(
    (difficulty: QuizDifficulty) => documentService.generateQuiz(courseId, id!, difficulty),
    [courseId, id],
  );
  const saveQuizSubmission = useCallback(async (answers: Record<string, string>, score: number, total: number) => {
    if (id && courseId) await documentService.saveQuizSubmission(courseId, id, answers, score, total);
  }, [id, courseId]);
  const quiz = useDifficultyQuiz({
    canGenerate: !!id && !!courseId,
    generationDisabled,
    targetQuizQuestionId,
    generate: generateQuizQuestions,
    saveSubmission: saveQuizSubmission,
  });

  // ─── Transcript helpers ─────────────────────────────────────────────────────

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
    return buildSrt(segs, withTimestamp);
  };

  const copyTranscript = (withTimestamp: boolean) => {
    navigator.clipboard.writeText(getTranscriptPlainText(withTimestamp));
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
  };

  // ─── Generation handlers ─────────────────────────────────────────────────────

  const generateSummary = useCallback(async () => {
    if (!id || !courseId || isLoadingSummary || generationDisabled) return;
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
      setSummaryStreamText('');
      setSummary(null);
      setSummaryError(getApiErrorCode(err));
    } finally {
      setIsLoadingSummary(false);
    }
  }, [id, courseId, isLoadingSummary, generationDisabled]);

  const generateMindMap = useCallback(async () => {
    if (!id || !courseId || isLoadingMindMap || generationDisabled) return;
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
      setMindMapError(getApiErrorCode(err));
    } finally {
      setIsLoadingMindMap(false);
    }
  }, [id, courseId, isLoadingMindMap, generationDisabled]);

  const handleSaveSummary = useCallback(async (markdown: string) => {
    if (!id || !courseId) return;
    await documentService.updateSummary(courseId, id, markdown);
    setSummary(markdown);
  }, [id, courseId]);

  const handleSaveMindMap = useCallback(async (text: string) => {
    if (!id || !courseId) return;
    await documentService.updateMindMap(courseId, id, text);
    setMindMapText(text);
  }, [id, courseId]);

  const generateFlashcards = useCallback(async () => {
    if (!id || !courseId || isLoadingFlashcards || generationDisabled) return;
    setFlashcardsError(null);
    setIsLoadingFlashcards(true);
    try {
      const cards = await documentService.generateFlashcards(courseId, id);
      setFlashcards(cards.map(c => ({ id: c.id, front: c.front, back: c.back, cardType: c.cardType })));
    } catch (err: any) {
      setFlashcardsError(getApiErrorCode(err));
    } finally {
      setIsLoadingFlashcards(false);
    }
  }, [id, courseId, isLoadingFlashcards, generationDisabled]);

  return {
    id, courseId, navigate,
    fileName, isPodcast, podcastOriginalUrl, audioUrl, isLoadingPage,
    audioRef, activeSegmentRef, currentTime, setCurrentTime,
    transcript, isTranscribing, transcriptError, handleTranscribe, seekAudioTo,
    copyTranscript, downloadTranscript,
    activeTab, setActiveTab, activeView, setActiveView, targetQuizQuestionId,
    summary, isLoadingSummary, summaryStreamText, summaryError, generateSummary, handleSaveSummary,
    summaryRef, summaryToolbar, setSummaryToolbar, handleSummaryMouseUp,
    mindMapText, isLoadingMindMap, mindMapStreamingText, mindMapError, generateMindMap, handleSaveMindMap,
    showShareModal, setShowShareModal,
    noteContent, noteEditorRef, handleNoteSave: saveNote,
    flashcards, isLoadingFlashcards, flashcardsError, generateFlashcards,
    activeQuizDifficulty: quiz.activeQuizDifficulty, quizQuestionSets: quiz.quizQuestionSets,
    quizQuestions: quiz.quizQuestions, userAnswers: quiz.userAnswers, isQuizSubmitted: quiz.isQuizSubmitted,
    quizScore: quiz.quizScore, isLoadingQuiz: quiz.isLoadingQuiz, quizError: quiz.quizError,
    generateQuiz: quiz.generateQuiz, handleQuizDifficultyChange: quiz.handleQuizDifficultyChange,
    submitQuiz: quiz.submitQuiz, onAnswerQuiz: quiz.onAnswerQuiz,
    chatMessages: docChat.messages, chatPanelRef, streamChat: docChat.streamChat,
    chatConversations: docChat.conversations, activeConversationId: docChat.activeConversationId,
    selectConversation: docChat.selectConversation, newConversation: docChat.newConversation,
    deleteConversation: docChat.deleteConversation,
    generationDisabled, generationDisabledReason, hasGeneratedQuizzes: quiz.hasGeneratedQuizzes,
  };
}
