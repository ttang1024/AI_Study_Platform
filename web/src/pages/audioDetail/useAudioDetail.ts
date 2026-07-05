import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useStudy } from '../../context/StudyContext';
import { documentService } from '../../services/documentService';
import { type ChatMessageAttachment } from '../../services/aiService';
import { useDocumentChatThreads } from '../../components/ai/useDocumentChatThreads';
import { audioService } from '../../services/audioService';
import { VideoNoteEditorRef } from '../../components/youtube/VideoNoteEditor';
import { ChatPanelRef } from '../../components/ai/ChatPanel';
import { QuizQuestion } from '../../types';
import { getApiErrorCode } from '../../utils/apiError';
import { parseTranscript, formatTime, fmtSrtTime } from './transcript';

export interface SimpleCard { id: string; front: string; back: string; cardType?: 'basic' | 'cloze' | 'chart'; }
export interface ChatMsg { id: string; role: 'user' | 'model'; content: string; isError?: boolean; attachments?: ChatMessageAttachment[]; }
export type AudioStudyTab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';

const emptyQuizSets = (): Record<QuizDifficulty, QuizQuestion[]> => ({ easy: [], medium: [], hard: [] });
const emptyAnswerSets = (): Record<QuizDifficulty, Record<string, string>> => ({ easy: {}, medium: {}, hard: {} });
const emptySubmittedSets = (): Record<QuizDifficulty, boolean> => ({ easy: false, medium: false, hard: false });
const emptyScoreSets = (): Record<QuizDifficulty, number> => ({ easy: 0, medium: 0, hard: 0 });

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
  const [openMenu, setOpenMenu] = useState<'copy' | 'download' | null>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

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
  const [activeQuizDifficulty, setActiveQuizDifficulty] = useState<QuizDifficulty>('medium');
  const [quizQuestionSets, setQuizQuestionSets] = useState<Record<QuizDifficulty, QuizQuestion[]>>(emptyQuizSets);
  const [quizAnswerSets, setQuizAnswerSets] = useState<Record<QuizDifficulty, Record<string, string>>>(emptyAnswerSets);
  const [quizSubmittedSets, setQuizSubmittedSets] = useState<Record<QuizDifficulty, boolean>>(emptySubmittedSets);
  const [quizScoreSets, setQuizScoreSets] = useState<Record<QuizDifficulty, number>>(emptyScoreSets);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Chat — multiple conversations (threads), shared with document/article pages
  const docChat = useDocumentChatThreads(courseId || null, id || null);
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

      if (doc.contentType === 'audio/podcast') {
        const directUrl = await audioService.getAudioUrl(cId, docId);
        setAudioUrl(directUrl);
      } else {
        const objectUrl = await audioService.getAudioBlobUrl(cId, docId);
        audioObjectUrlRef.current = objectUrl;
        setAudioUrl(objectUrl);
      }

      // Load saved notes
      try {
        const notes = await documentService.getNotes(cId, docId);
        if (notes.length > 0) { setNoteContent(notes[0].content); setNoteId(notes[0].id); }
      } catch { }

      // Load flashcards
      try {
        const cards = await documentService.getFlashcards(cId, docId);
        setFlashcards(cards.map(c => ({ id: c.id, front: c.front, back: c.back, cardType: c.cardType })));
      } catch { }

      // Load quiz
      let loadedQuizDifficulty = activeQuizDifficulty;
      let loadedQuizQuestionSets = emptyQuizSets();
      try {
        const questions = await documentService.getQuiz(cId, docId);
        const grouped = emptyQuizSets();
        questions.forEach(q => grouped[(q.difficulty ?? 'medium') as QuizDifficulty].push(q));
        const targetDifficulty = targetQuizQuestionId
          ? (['easy', 'medium', 'hard'] as QuizDifficulty[]).find(difficulty =>
            grouped[difficulty].some(q => q.id === targetQuizQuestionId))
          : undefined;
        const loadedDifficulty = targetDifficulty
          ?? (grouped[activeQuizDifficulty].length > 0
            ? activeQuizDifficulty
            : (['easy', 'medium', 'hard'] as QuizDifficulty[]).find(difficulty => grouped[difficulty].length > 0) ?? activeQuizDifficulty);
        loadedQuizDifficulty = loadedDifficulty;
        loadedQuizQuestionSets = grouped;
        setQuizQuestionSets(grouped);
        setActiveQuizDifficulty(loadedDifficulty);
        setQuizQuestions(grouped[loadedDifficulty]);
      } catch { }

      // Load quiz submission
      try {
        const sub = await documentService.getQuizSubmission(cId, docId);
        if (sub) {
          const submittedDifficulty = (['easy', 'medium', 'hard'] as QuizDifficulty[]).find(difficulty =>
            Object.keys(sub.answers ?? {}).some(questionId => loadedQuizQuestionSets[difficulty].some(q => q.id === questionId)))
            ?? loadedQuizDifficulty;
          setActiveQuizDifficulty(submittedDifficulty);
          setQuizQuestions(loadedQuizQuestionSets[submittedDifficulty]);
          setUserAnswers(sub.answers);
          setQuizAnswerSets(prev => ({ ...prev, [submittedDifficulty]: sub.answers }));
          setQuizScore(sub.score);
          setQuizScoreSets(prev => ({ ...prev, [submittedDifficulty]: sub.score }));
          setIsQuizSubmitted(true);
          setQuizSubmittedSets(prev => ({ ...prev, [submittedDifficulty]: true }));
        }
      } catch { }

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
  const hasGeneratedQuizzes = Object.values(quizQuestionSets).some(questions => questions.length > 0);

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

  const generateQuiz = useCallback(async (difficulty: QuizDifficulty = activeQuizDifficulty) => {
    if (!id || !courseId || isLoadingQuiz || generationDisabled) return;
    setActiveQuizDifficulty(difficulty);
    setQuizError(null);
    setIsLoadingQuiz(true);
    setQuizQuestions([]);
    setQuizQuestionSets(prev => ({ ...prev, [difficulty]: [] }));
    setUserAnswers({});
    setQuizAnswerSets(prev => ({ ...prev, [difficulty]: {} }));
    setIsQuizSubmitted(false);
    setQuizSubmittedSets(prev => ({ ...prev, [difficulty]: false }));
    setQuizScore(0);
    setQuizScoreSets(prev => ({ ...prev, [difficulty]: 0 }));
    try {
      const questions = await documentService.generateQuiz(courseId, id, difficulty);
      setQuizQuestions(questions);
      setQuizQuestionSets(prev => ({ ...prev, [difficulty]: questions }));
    } catch (err: any) {
      setQuizError(getApiErrorCode(err));
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [id, courseId, isLoadingQuiz, generationDisabled, activeQuizDifficulty]);

  const handleQuizDifficultyChange = useCallback((difficulty: QuizDifficulty) => {
    setActiveQuizDifficulty(difficulty);
    setQuizError(null);
    setQuizQuestions(quizQuestionSets[difficulty]);
    setUserAnswers(quizAnswerSets[difficulty]);
    setIsQuizSubmitted(quizSubmittedSets[difficulty]);
    setQuizScore(quizScoreSets[difficulty]);
  }, [quizQuestionSets, quizAnswerSets, quizSubmittedSets, quizScoreSets]);

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
    setQuizScoreSets(prev => ({ ...prev, [activeQuizDifficulty]: score }));
    setIsQuizSubmitted(true);
    setQuizSubmittedSets(prev => ({ ...prev, [activeQuizDifficulty]: true }));
    if (id && courseId) {
      try { await documentService.saveQuizSubmission(courseId, id, userAnswers, score, quizQuestions.length); } catch { }
    }
  }, [quizQuestions, userAnswers, id, courseId, activeQuizDifficulty]);

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

  const onAnswerQuiz = (qId: string, option: string) => {
    if (isQuizSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [qId]: option }));
    setQuizAnswerSets(prev => ({
      ...prev,
      [activeQuizDifficulty]: { ...prev[activeQuizDifficulty], [qId]: option },
    }));
  };

  return {
    id, courseId, navigate,
    fileName, isPodcast, podcastOriginalUrl, audioUrl, isLoadingPage,
    audioRef, activeSegmentRef, currentTime, setCurrentTime,
    transcript, isTranscribing, transcriptError, handleTranscribe, seekAudioTo,
    openMenu, setOpenMenu, copyMenuRef, downloadMenuRef, copyTranscript, downloadTranscript,
    activeTab, setActiveTab, activeView, setActiveView, targetQuizQuestionId,
    summary, isLoadingSummary, summaryStreamText, summaryError, generateSummary, handleSaveSummary,
    mindMapText, isLoadingMindMap, mindMapStreamingText, mindMapError, generateMindMap, handleSaveMindMap,
    showShareModal, setShowShareModal,
    noteContent, noteEditorRef, handleNoteSave,
    flashcards, isLoadingFlashcards, flashcardsError, generateFlashcards,
    activeQuizDifficulty, quizQuestionSets, quizQuestions, userAnswers, isQuizSubmitted,
    quizScore, isLoadingQuiz, quizError, generateQuiz, handleQuizDifficultyChange, submitQuiz, onAnswerQuiz,
    chatMessages: docChat.messages, chatPanelRef, streamChat: docChat.streamChat,
    chatConversations: docChat.conversations, activeConversationId: docChat.activeConversationId,
    selectConversation: docChat.selectConversation, newConversation: docChat.newConversation,
    deleteConversation: docChat.deleteConversation,
    generationDisabled, generationDisabledReason, hasGeneratedQuizzes,
  };
}
