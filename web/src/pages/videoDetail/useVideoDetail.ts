import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { aiService } from '../../services/aiService';
import { videoService, TranscriptSegment } from '../../services/videoService';
import { VideoNoteEditorRef } from '../../components/youtube/VideoNoteEditor';
import { ChatPanelRef } from '../../components/ai/ChatPanel';
import { QuizQuestion } from '../../types';
import { getApiErrorCode } from '../../utils/apiError';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import {
  parseVideoId, parseBilibiliVideo, isOptionCorrect, fmtTime, fmtSrtTime,
} from './helpers';

export interface SimpleCard { id: string; front: string; back: string; cardType?: 'basic' | 'cloze' | 'chart'; }
export interface ChatMsg { id: string; role: 'user' | 'model'; content: string; isError?: boolean; }
export type VideoStudyTab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export interface SelectionToolbar { x: number; y: number; text: string; }

const emptyQuizSets = (): Record<QuizDifficulty, QuizQuestion[]> => ({ easy: [], medium: [], hard: [] });
const emptyAnswerSets = (): Record<QuizDifficulty, Record<string, string>> => ({ easy: {}, medium: {}, hard: {} });
const emptySubmittedSets = (): Record<QuizDifficulty, boolean> => ({ easy: false, medium: false, hard: false });
const emptyScoreSets = (): Record<QuizDifficulty, number> => ({ easy: 0, medium: 0, hard: 0 });

interface VideoDetailLocationState {
  activeTab?: VideoStudyTab;
  returnTo?: string;
  targetQuizQuestionId?: string;
}

/** All state, data loading and study-action handlers for the video detail page. */
export function useVideoDetail(propId?: string) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId ?? paramId;
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as VideoDetailLocationState | null;

  // Video URL (loaded from API)
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'youtube' | 'bilibili' | 'upload'>('youtube');
  const [bilibiliStartSeconds, setBilibiliStartSeconds] = useState(0);
  const [bilibiliSeekNonce, setBilibiliSeekNonce] = useState(0);
  const bilibiliVideo = videoUrl && sourceType === 'bilibili' ? parseBilibiliVideo(videoUrl) : null;
  const videoId = videoUrl ? (sourceType === 'bilibili' ? bilibiliVideo?.key ?? null : sourceType === 'upload' ? id ?? null : parseVideoId(videoUrl)) : null;

  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  const [courseId, setCourseId] = useState<string | null>(null);

  // Attribute watching/studying time on this video to its course in analytics.
  useStudyTimer({ contextType: 'video', courseId, contextId: id, enabled: !isLoadingVideo });

  // Layout
  const initialTab = locationState?.activeTab ?? 'summary';
  const [activeTab, setActiveTab] = useState<VideoStudyTab>(initialTab);
  const [activeView, setActiveView] = useState<'study' | 'video'>('video');

  // Per-module errors
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [mindMapError, setMindMapError] = useState<string | null>(null);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Note
  const [noteContent, setNoteContent] = useState<string>('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Summary
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryStreamText, setSummaryStreamText] = useState('');

  // Text selection toolbars
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryToolbar, setSummaryToolbar] = useState<SelectionToolbar | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [transcriptToolbar, setTranscriptToolbar] = useState<SelectionToolbar | null>(null);

  // Center panel view: transcript or subtitles
  const [centerView, setCenterView] = useState<'transcript' | 'subtitles'>('transcript');

  // Transcript
  const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);

  // Subtitles (raw caption lines)
  const [subtitles, setSubtitles] = useState<TranscriptSegment[] | null>(null);
  const [subtitlesError, setSubtitlesError] = useState<string | null>(null);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  const [resolvedSubtitlesVideoId, setResolvedSubtitlesVideoId] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);

  // Transcript copy/download menus
  const [openMenu, setOpenMenu] = useState<'copy' | 'download' | null>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Mind Map
  const [mindMapText, setMindMapText] = useState<string | null>(null);
  const [isLoadingMindMap, setIsLoadingMindMap] = useState(false);
  const [mindMapStreamingText, setMindMapStreamingText] = useState<string | null>(null);

  // Flashcards
  const [flashcards, setFlashcards] = useState<SimpleCard[]>([]);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);

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

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  // Refs for cross-panel actions
  const noteEditorRef = useRef<VideoNoteEditorRef>(null);
  const chatPanelRef = useRef<ChatPanelRef>(null);
  const bilibiliSeekTimerRef = useRef<number | null>(null);

  const loadVideoFromApi = async (videoRecordId: string) => {
    setIsLoadingVideo(true);
    try {
      const v = await videoService.getVideo(videoRecordId);
      setCourseId(v.courseId ?? null);
      setSummary(v.summary ?? null);
      setMindMapText(v.mindMapText ?? null);
      setVideoUrl(v.videoUrl);
      setSourceType(v.sourceType ?? 'youtube');
      setBilibiliStartSeconds(0);
      setBilibiliSeekNonce(0);
      if (bilibiliSeekTimerRef.current != null) {
        window.clearTimeout(bilibiliSeekTimerRef.current);
        bilibiliSeekTimerRef.current = null;
      }
      setVideoTitle(v.title ?? null);
      if ((v.sourceType ?? 'youtube') === 'upload') {
        setPlaybackUrl(videoService.getUploadedVideoStreamUrl(videoRecordId));
      } else {
        setPlaybackUrl(v.videoUrl);
      }

      try {
        const cards = await videoService.getFlashcards(videoRecordId);
        setFlashcards(cards.map(c => ({ id: c.flashcardId, front: c.front, back: c.back, cardType: c.cardType ?? 'basic' })));
      } catch { }

      let loadedQuizDifficulty = activeQuizDifficulty;
      let loadedQuizQuestionSets = emptyQuizSets();
      try {
        const questions = await videoService.getQuiz(videoRecordId);
        const mapped = questions.map(q => ({
          id: q.quizId,
          question: q.question,
          options: q.options,
          answer: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty ?? 'medium',
        } as QuizQuestion));
        const grouped = emptyQuizSets();
        mapped.forEach(q => grouped[(q.difficulty ?? 'medium') as QuizDifficulty].push(q));
        const targetDifficulty = locationState?.targetQuizQuestionId
          ? (['easy', 'medium', 'hard'] as QuizDifficulty[]).find(difficulty =>
            grouped[difficulty].some(q => q.id === locationState.targetQuizQuestionId))
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

      try {
        const note = await videoService.getVideoNote(videoRecordId);
        if (note) {
          setNoteContent(note.content);
          setNoteId(note.noteId);
        }
      } catch { }

      try {
        const submission = await videoService.getQuizSubmission(videoRecordId);
        if (submission) {
          const submittedDifficulty = (['easy', 'medium', 'hard'] as QuizDifficulty[]).find(difficulty =>
            Object.keys(submission.answers ?? {}).some(questionId => loadedQuizQuestionSets[difficulty].some(q => q.id === questionId)))
            ?? loadedQuizDifficulty;
          setActiveQuizDifficulty(submittedDifficulty);
          setQuizQuestions(loadedQuizQuestionSets[submittedDifficulty]);
          setUserAnswers(submission.answers);
          setQuizAnswerSets(prev => ({ ...prev, [submittedDifficulty]: submission.answers }));
          setQuizScore(submission.score);
          setQuizScoreSets(prev => ({ ...prev, [submittedDifficulty]: submission.score }));
          setIsQuizSubmitted(true);
          setQuizSubmittedSets(prev => ({ ...prev, [submittedDifficulty]: true }));
        }
      } catch { }

      try {
        const history = await videoService.getChatHistory(videoRecordId);
        setChatMessages(history);
      } catch { }

    } catch {
      navigate('/videos');
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // Load video record on mount
  useEffect(() => {
    if (id) loadVideoFromApi(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      requestAnimationFrame(() => chatPanelRef.current?.scrollToBottom());
    }
  }, [activeTab]);

  const handleBack = useCallback(() => {
    if (locationState?.returnTo?.startsWith('/')) {
      navigate(locationState.returnTo, { replace: true });
      return;
    }
    navigate(-1);
  }, [locationState?.returnTo, navigate]);

  // ─── Transcript / subtitles fetching ─────────────────────────────────────────

  const doFetchVideoTranscript = async (videoRecordId: string) => {
    setIsLoadingTranscript(true);
    setTranscriptError(null);
    try {
      const segments = await videoService.getVideoTranscript(videoRecordId);
      setTranscript(segments.length > 0 ? segments : null);
    } catch (err: any) {
      setTranscriptError(err?.response?.data?.message ?? 'No captions available for this video.');
      setTranscript(null);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const doFetchVideoSubtitles = async (videoRecordId: string) => {
    setIsLoadingSubtitles(true);
    setSubtitlesError(null);
    setResolvedSubtitlesVideoId(null);
    try {
      const segments = await videoService.getVideoSubtitles(videoRecordId);
      setSubtitles(segments.length > 0 ? segments : null);
    } catch (err: any) {
      setSubtitlesError(err?.response?.data?.message ?? 'No captions available for this video.');
      setSubtitles(null);
    } finally {
      setResolvedSubtitlesVideoId(videoRecordId);
      setIsLoadingSubtitles(false);
    }
  };

  const doFetchTranscript = async (vid: string) => {
    setIsLoadingTranscript(true);
    setTranscriptError(null);
    try {
      const segments = await videoService.getTranscript(vid);
      setTranscript(segments.length > 0 ? segments : null);
    } catch (err: any) {
      setTranscriptError(err?.response?.data?.message ?? 'No captions available for this video.');
      setTranscript(null);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const doFetchSubtitles = async (vid: string) => {
    setIsLoadingSubtitles(true);
    setSubtitlesError(null);
    setResolvedSubtitlesVideoId(null);
    try {
      const segments = await videoService.getSubtitles(vid);
      setSubtitles(segments.length > 0 ? segments : null);
    } catch (err: any) {
      setSubtitlesError(err?.response?.data?.message ?? 'No captions available for this video.');
      setSubtitles(null);
    } finally {
      setResolvedSubtitlesVideoId(vid);
      setIsLoadingSubtitles(false);
    }
  };

  // Fetch transcript when video loads
  useEffect(() => {
    if (!videoId || !videoUrl || !id) return;
    setResolvedSubtitlesVideoId(null);
    setSubtitles(null);
    setSubtitlesError(null);
    if (sourceType === 'youtube') {
      doFetchSubtitles(videoId).then(() => doFetchTranscript(videoId));
    } else {
      doFetchVideoSubtitles(id).then(() => doFetchVideoTranscript(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, sourceType, id]);

  const seekTo = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    if (sourceType === 'youtube') {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [safeSeconds, true] }),
        '*'
      );
      return;
    }

    if (sourceType === 'upload') {
      const player = uploadedVideoRef.current;
      if (!player) return;
      player.currentTime = safeSeconds;
      player.play().catch(() => { });
      return;
    }

    if (sourceType === 'bilibili') {
      if (bilibiliSeekTimerRef.current != null) {
        window.clearTimeout(bilibiliSeekTimerRef.current);
      }
      bilibiliSeekTimerRef.current = window.setTimeout(() => {
        setBilibiliStartSeconds(safeSeconds);
        setBilibiliSeekNonce(prev => prev + 1);
        bilibiliSeekTimerRef.current = null;
      }, 200);
    }
  };

  const refreshTranscript = () => {
    if (sourceType === 'youtube' && videoId) {
      void doFetchTranscript(videoId);
      return;
    }
    if (id) void doFetchVideoTranscript(id);
  };

  const refreshSubtitles = () => {
    if (sourceType === 'youtube' && videoId) {
      void doFetchSubtitles(videoId);
      return;
    }
    if (id) void doFetchVideoSubtitles(id);
  };

  const loadSubtitlesOnDemand = () => {
    if (subtitles || subtitlesError || isLoadingSubtitles || !videoId) return;
    if (sourceType === 'youtube') doFetchSubtitles(videoId);
    else if (id) doFetchVideoSubtitles(id);
  };

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

  // ─── Transcript export ───────────────────────────────────────────────────────

  const getTranscriptText = (withTimestamp: boolean) => {
    if (!transcript) return '';
    return withTimestamp
      ? transcript.map(seg => `[${fmtTime(seg.startSeconds)}] ${seg.text}`).join('\n')
      : transcript.map(seg => seg.text).join(' ');
  };

  const getTranscriptSrt = (withTimestamp: boolean) => {
    if (!transcript) return '';
    return transcript.map((seg, i) => {
      const start = seg.startSeconds;
      const end = transcript[i + 1]?.startSeconds ?? start + 5;
      return withTimestamp
        ? `${i + 1}\n${fmtSrtTime(start)} --> ${fmtSrtTime(end)}\n${seg.text}`
        : `${i + 1}\n${seg.text}`;
    }).join('\n\n');
  };

  const copyTranscript = (withTimestamp: boolean) => {
    navigator.clipboard.writeText(getTranscriptText(withTimestamp));
    setOpenMenu(null);
  };

  const downloadTranscript = (format: 'txt' | 'srt', withTimestamp: boolean) => {
    const content = format === 'srt' ? getTranscriptSrt(withTimestamp) : getTranscriptText(withTimestamp);
    const suffix = withTimestamp ? '_timestamps' : '';
    const base = (videoTitle ?? videoId ?? 'transcript').replace(/[^a-z0-9_\-]/gi, '_');
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

  const resolvedTranscriptKey = sourceType === 'youtube' ? videoId : id;
  const generationDisabled = !videoId || resolvedSubtitlesVideoId !== resolvedTranscriptKey;
  const generationDisabledReason = 'Waiting for subtitles to finish loading.';
  const hasGeneratedQuizzes = Object.values(quizQuestionSets).some(questions => questions.length > 0);

  // ─── Generation handlers ─────────────────────────────────────────────────────

  const doGenerateSummary = async (url: string) => {
    if (generationDisabled) return;
    setSummaryError(null);
    setIsLoadingSummary(true);
    setSummaryStreamText('');
    try {
      let accumulated = '';
      const stream = id ? videoService.streamVideoSummary(id, (chunk) => {
        accumulated += chunk;
        setSummaryStreamText(accumulated);
      }) : videoService.streamSummary(url, (chunk) => {
        accumulated += chunk;
        setSummaryStreamText(accumulated);
      });
      await stream;
      setSummary(accumulated || null);
      setSummaryStreamText('');
      if (id && accumulated) {
        await videoService.updateVideo(id, { summary: accumulated });
      }
    } catch (err: any) {
      setSummary(null);
      setSummaryStreamText('');
      setSummaryError(getApiErrorCode(err));
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const generateSummary = () => {
    if (videoUrl && !isLoadingSummary && !generationDisabled) doGenerateSummary(videoUrl);
  };

  const generateMindMap = useCallback(async () => {
    if (!videoUrl || isLoadingMindMap || generationDisabled) return;
    setMindMapError(null);
    setIsLoadingMindMap(true);
    setMindMapStreamingText('');
    const accum = { current: '' };
    try {
      await (id ? videoService.streamVideoMindMap(id, (chunk) => {
        accum.current += chunk;
        setMindMapStreamingText(accum.current);
      }) : aiService.streamMindMapFromYouTube(videoUrl, (chunk) => {
        accum.current += chunk;
        setMindMapStreamingText(accum.current);
      }));
      const result = accum.current;
      setMindMapText(result);
      setMindMapStreamingText(null);
      if (id) {
        await videoService.updateVideo(id, { mindMapText: result });
      }
    } catch (err: any) {
      setMindMapStreamingText(null);
      setMindMapError(getApiErrorCode(err));
    } finally {
      setIsLoadingMindMap(false);
    }
  }, [videoUrl, isLoadingMindMap, id, generationDisabled]);

  const generateFlashcards = useCallback(async () => {
    if (!videoUrl || isLoadingFlashcards || !id || generationDisabled) return;
    setFlashcardsError(null);
    setIsLoadingFlashcards(true);
    try {
      const cards = await videoService.generateFlashcards(id, videoUrl);
      setFlashcards(cards.map(c => ({ id: c.flashcardId, front: c.front, back: c.back, cardType: c.cardType ?? 'basic' })));
    } catch (err: any) {
      setFlashcardsError(getApiErrorCode(err));
    } finally {
      setIsLoadingFlashcards(false);
    }
  }, [videoUrl, isLoadingFlashcards, id, generationDisabled]);

  const generateQuiz = useCallback(async (difficulty: QuizDifficulty = activeQuizDifficulty) => {
    if (!videoUrl || isLoadingQuiz || !id || generationDisabled) return;
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
      const questions = await videoService.generateQuiz(id, videoUrl, difficulty);
      const mapped = questions.map(q => ({
        id: q.quizId,
        question: q.question,
        options: q.options,
        answer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty ?? difficulty,
      } as QuizQuestion));
      setQuizQuestions(mapped);
      setQuizQuestionSets(prev => ({ ...prev, [difficulty]: mapped }));
    } catch (err: any) {
      setQuizError(getApiErrorCode(err));
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [videoUrl, isLoadingQuiz, id, generationDisabled, activeQuizDifficulty]);

  const handleQuizDifficultyChange = useCallback((difficulty: QuizDifficulty) => {
    setActiveQuizDifficulty(difficulty);
    setQuizError(null);
    setQuizQuestions(quizQuestionSets[difficulty]);
    setUserAnswers(quizAnswerSets[difficulty]);
    setIsQuizSubmitted(quizSubmittedSets[difficulty]);
    setQuizScore(quizScoreSets[difficulty]);
  }, [quizQuestionSets, quizAnswerSets, quizSubmittedSets, quizScoreSets]);

  const handleNoteSave = useCallback(async (html: string) => {
    setNoteContent(html);
    if (!id) return;
    try {
      if (noteId) {
        await videoService.updateNote(noteId, html);
      } else {
        const note = await videoService.createNote(html, id);
        setNoteId(note.noteId);
      }
    } catch { }
  }, [id, noteId]);

  const submitQuiz = useCallback(async () => {
    let score = 0;
    quizQuestions.forEach(q => {
      if (userAnswers[q.id] && isOptionCorrect(userAnswers[q.id], q.answer)) score++;
    });
    setQuizScore(score);
    setQuizScoreSets(prev => ({ ...prev, [activeQuizDifficulty]: score }));
    setIsQuizSubmitted(true);
    setQuizSubmittedSets(prev => ({ ...prev, [activeQuizDifficulty]: true }));
    if (id) {
      try {
        await videoService.submitQuiz(id, userAnswers, score, quizQuestions.length);
      } catch { }
    }
  }, [quizQuestions, userAnswers, id, activeQuizDifficulty]);

  const onAnswerQuiz = (qId: string, option: string) => {
    if (isQuizSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [qId]: option }));
    setQuizAnswerSets(prev => ({
      ...prev,
      [activeQuizDifficulty]: { ...prev[activeQuizDifficulty], [qId]: option },
    }));
  };

  const streamChat = async (message: string, onChunk: (chunk: string) => void) => {
    if (!id) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: message };
    setChatMessages(prev => [...prev, userMsg]);
    let accumulated = '';
    try {
      await videoService.streamChat(id, message, (chunk) => {
        accumulated += chunk;
        onChunk(chunk);
      });
      setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: accumulated }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: getApiErrorCode(err), isError: true }]);
      throw err;
    }
  };

  const handleSummaryMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection?.rangeCount) { setSummaryToolbar(null); return; }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setSummaryToolbar({ x: rect.left + rect.width / 2, y: rect.top - 12, text });
  }, []);

  const handleTranscriptMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || !selection?.rangeCount) { setTranscriptToolbar(null); return; }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    setTranscriptToolbar({ x: rect.left + rect.width / 2, y: rect.top - 12, text });
  }, []);

  return {
    id, videoUrl, playbackUrl, videoTitle, sourceType, bilibiliVideo, videoId,
    bilibiliStartSeconds, bilibiliSeekNonce, isLoadingVideo, handleBack,
    activeTab, setActiveTab, activeView, setActiveView, locationState,
    summaryError, mindMapError, flashcardsError, quizError,
    noteContent, showShareModal, setShowShareModal,
    summary, isLoadingSummary, summaryStreamText, generateSummary,
    summaryRef, summaryToolbar, setSummaryToolbar,
    transcriptRef, transcriptToolbar, setTranscriptToolbar,
    centerView, setCenterView, loadSubtitlesOnDemand,
    transcript, transcriptError, isLoadingTranscript, refreshTranscript,
    subtitles, subtitlesError, isLoadingSubtitles, refreshSubtitles,
    iframeRef, uploadedVideoRef,
    openMenu, setOpenMenu, copyMenuRef, downloadMenuRef, copyTranscript, downloadTranscript,
    mindMapText, isLoadingMindMap, mindMapStreamingText, generateMindMap,
    flashcards, isLoadingFlashcards, generateFlashcards,
    activeQuizDifficulty, quizQuestionSets, quizQuestions, userAnswers, isQuizSubmitted,
    quizScore, isLoadingQuiz, generateQuiz, handleQuizDifficultyChange, submitQuiz, onAnswerQuiz,
    chatMessages, chatPanelRef, streamChat,
    noteEditorRef, handleNoteSave, seekTo,
    generationDisabled, generationDisabledReason, hasGeneratedQuizzes,
    handleSummaryMouseUp, handleTranscriptMouseUp,
  };
}
