import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { aiService } from '../../services/aiService';
import { videoService, type VideoChatConversation } from '../../services/videoService';
import { VideoNoteEditorRef } from '../../components/youtube/VideoNoteEditor';
import { getApiErrorCode } from '../../utils/apiError';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { useSelectionToolbar } from '../../hooks/useSelectionToolbar';
import { useVideoTranscript } from './useVideoTranscript';
import { useVideoQuiz } from './useVideoQuiz';
import { useVideoChat } from './useVideoChat';
import { parseVideoId, parseBilibiliVideo } from './helpers';
import { isExternalVideoSource, type VideoSourceType } from '../../constants/videoSources';
import type { SimpleCard, ChatMsg, VideoStudyTab, QuizDifficulty, SelectionToolbar, VideoDetailLocationState } from './types';

export type { SimpleCard, ChatMsg, VideoStudyTab, QuizDifficulty, SelectionToolbar };

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
  const [sourceType, setSourceType] = useState<VideoSourceType>('youtube');
  // Seek-by-reload state for iframe players without a seek API (Bilibili, Vimeo, TED, Dailymotion).
  const [embedStartSeconds, setEmbedStartSeconds] = useState(0);
  const [embedSeekNonce, setEmbedSeekNonce] = useState(0);
  const bilibiliVideo = videoUrl && sourceType === 'bilibili' ? parseBilibiliVideo(videoUrl) : null;
  const videoId = videoUrl
    ? (sourceType === 'bilibili' ? bilibiliVideo?.key ?? null
      : sourceType === 'youtube' ? parseVideoId(videoUrl)
      : id ?? null)
    : null;

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

  // Note
  const [noteContent, setNoteContent] = useState<string>('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Summary
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryStreamText, setSummaryStreamText] = useState('');

  // Text selection toolbar (summary panel — the transcript panel's toolbar lives in useVideoTranscript)
  const summaryRef = useRef<HTMLDivElement>(null);
  const { toolbar: summaryToolbar, setToolbar: setSummaryToolbar, onMouseUp: handleSummaryMouseUp } = useSelectionToolbar();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const uploadedVideoRef = useRef<HTMLVideoElement>(null);

  // Mind Map
  const [mindMapText, setMindMapText] = useState<string | null>(null);
  const [isLoadingMindMap, setIsLoadingMindMap] = useState(false);
  const [mindMapStreamingText, setMindMapStreamingText] = useState<string | null>(null);

  // Flashcards
  const [flashcards, setFlashcards] = useState<SimpleCard[]>([]);
  const [isLoadingFlashcards, setIsLoadingFlashcards] = useState(false);

  // Refs for cross-panel actions
  const noteEditorRef = useRef<VideoNoteEditorRef>(null);
  const embedSeekTimerRef = useRef<number | null>(null);

  const transcript = useVideoTranscript({ id, videoId, videoUrl, sourceType, videoTitle });

  const resolvedTranscriptKey = sourceType === 'youtube' ? videoId : id;
  const generationDisabled = !videoId || transcript.resolvedSubtitlesVideoId !== resolvedTranscriptKey;
  const generationDisabledReason = 'Waiting for subtitles to finish loading.';

  const quiz = useVideoQuiz({ id, videoUrl, generationDisabled, targetQuizQuestionId: locationState?.targetQuizQuestionId });
  const chat = useVideoChat({ id, activeTab });

  const loadVideoFromApi = async (videoRecordId: string) => {
    setIsLoadingVideo(true);
    try {
      // Independent reads fire together instead of one-at-a-time; only the message fetch
      // has a real dependency (it needs the conversation id from the conversations call).
      const conversationsPromise = videoService.listChatConversations(videoRecordId).catch(() => [] as VideoChatConversation[]);
      const messagesPromise = conversationsPromise.then(conversations =>
        conversations.length > 0
          ? videoService.getConversationMessages(videoRecordId, conversations[0].conversationId).catch(() => [] as ChatMsg[])
          : Promise.resolve([] as ChatMsg[]));

      const [v, cards, questions, submission, note, conversations, messages] = await Promise.all([
        videoService.getVideo(videoRecordId),
        videoService.getFlashcards(videoRecordId).catch(() => null),
        videoService.getQuiz(videoRecordId).catch(() => null),
        videoService.getQuizSubmission(videoRecordId).catch(() => null),
        videoService.getVideoNote(videoRecordId).catch(() => null),
        conversationsPromise,
        messagesPromise,
      ]);

      setCourseId(v.courseId ?? null);
      setSummary(v.summary ?? null);
      setMindMapText(v.mindMapText ?? null);
      setVideoUrl(v.videoUrl);
      setSourceType(v.sourceType ?? 'youtube');
      setEmbedStartSeconds(0);
      setEmbedSeekNonce(0);
      if (embedSeekTimerRef.current != null) {
        window.clearTimeout(embedSeekTimerRef.current);
        embedSeekTimerRef.current = null;
      }
      setVideoTitle(v.title ?? null);
      if ((v.sourceType ?? 'youtube') === 'upload') {
        setPlaybackUrl(videoService.getUploadedVideoStreamUrl(videoRecordId));
      } else {
        setPlaybackUrl(v.videoUrl);
      }

      if (cards) {
        setFlashcards(cards.map(c => ({ id: c.flashcardId, front: c.front, back: c.back, cardType: c.cardType ?? 'basic' })));
      }

      quiz.applyLoadedQuiz(questions, submission);

      if (note) {
        setNoteContent(note.content);
        setNoteId(note.noteId);
      }

      chat.applyLoadedConversations(conversations, messages);
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

  const handleBack = useCallback(() => {
    if (locationState?.returnTo?.startsWith('/')) {
      navigate(locationState.returnTo, { replace: true });
      return;
    }
    navigate(-1);
  }, [locationState?.returnTo, navigate]);

  const seekTo = useCallback((seconds: number) => {
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

    if (sourceType === 'bilibili' || isExternalVideoSource(sourceType)) {
      if (embedSeekTimerRef.current != null) {
        window.clearTimeout(embedSeekTimerRef.current);
      }
      embedSeekTimerRef.current = window.setTimeout(() => {
        setEmbedStartSeconds(safeSeconds);
        setEmbedSeekNonce(prev => prev + 1);
        embedSeekTimerRef.current = null;
      }, 200);
    }
    // Refs and setState functions are stable; sourceType is the only value that should
    // invalidate this callback's identity. A recreated seekTo would otherwise remount the
    // markdown-rendered summary paragraphs on every unrelated re-render (e.g. text selection),
    // wiping the browser's native selection highlight out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType]);

  // A `?t=` in the URL means we arrived from a citation's "jump to source" link. Seek once the
  // player exists, and only once — re-seeking on every render would fight the user's own scrubbing.
  const deepLinkSeekedRef = useRef(false);
  useEffect(() => {
    if (deepLinkSeekedRef.current || isLoadingVideo) return;

    const raw = new URLSearchParams(location.search).get('t');
    if (!raw) return;

    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds < 0) return;

    deepLinkSeekedRef.current = true;
    seekTo(seconds);
    // seekTo is recreated every render and is not a meaningful dependency; the ref guards re-entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingVideo, location.search]);

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

  const handleSaveSummary = useCallback(async (markdown: string) => {
    if (!id) return;
    await videoService.updateVideo(id, { summary: markdown });
    setSummary(markdown);
  }, [id]);

  const handleSaveMindMap = useCallback(async (text: string) => {
    if (!id) return;
    await videoService.updateVideo(id, { mindMapText: text });
    setMindMapText(text);
  }, [id]);

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

  return {
    id, videoUrl, playbackUrl, videoTitle, sourceType, bilibiliVideo, videoId,
    embedStartSeconds, embedSeekNonce, isLoadingVideo, handleBack,
    activeTab, setActiveTab, activeView, setActiveView, locationState,
    summaryError, mindMapError, flashcardsError, quizError: quiz.quizError,
    noteContent, showShareModal, setShowShareModal,
    summary, isLoadingSummary, summaryStreamText, generateSummary, handleSaveSummary,
    summaryRef, summaryToolbar, setSummaryToolbar,
    transcriptRef: transcript.transcriptRef, transcriptToolbar: transcript.transcriptToolbar, setTranscriptToolbar: transcript.setTranscriptToolbar,
    centerView: transcript.centerView, setCenterView: transcript.setCenterView, loadSubtitlesOnDemand: transcript.loadSubtitlesOnDemand,
    transcript: transcript.transcript, transcriptError: transcript.transcriptError, isLoadingTranscript: transcript.isLoadingTranscript, refreshTranscript: transcript.refreshTranscript,
    subtitles: transcript.subtitles, subtitlesError: transcript.subtitlesError, isLoadingSubtitles: transcript.isLoadingSubtitles, refreshSubtitles: transcript.refreshSubtitles,
    iframeRef, uploadedVideoRef,
    openMenu: transcript.openMenu, setOpenMenu: transcript.setOpenMenu, copyMenuRef: transcript.copyMenuRef, downloadMenuRef: transcript.downloadMenuRef,
    copyTranscript: transcript.copyTranscript, downloadTranscript: transcript.downloadTranscript,
    mindMapText, isLoadingMindMap, mindMapStreamingText, generateMindMap, handleSaveMindMap,
    flashcards, isLoadingFlashcards, generateFlashcards,
    activeQuizDifficulty: quiz.activeQuizDifficulty, quizQuestionSets: quiz.quizQuestionSets, quizQuestions: quiz.quizQuestions,
    userAnswers: quiz.userAnswers, isQuizSubmitted: quiz.isQuizSubmitted,
    quizScore: quiz.quizScore, isLoadingQuiz: quiz.isLoadingQuiz, generateQuiz: quiz.generateQuiz,
    handleQuizDifficultyChange: quiz.handleQuizDifficultyChange, submitQuiz: quiz.submitQuiz, onAnswerQuiz: quiz.onAnswerQuiz,
    chatMessages: chat.chatMessages, chatPanelRef: chat.chatPanelRef, streamChat: chat.streamChat,
    chatConversations: chat.chatConversations, activeConversationId: chat.activeConversationId,
    selectConversation: chat.selectConversation, newConversation: chat.newConversation, deleteConversation: chat.deleteConversation,
    noteEditorRef, handleNoteSave, seekTo,
    generationDisabled, generationDisabledReason, hasGeneratedQuizzes: quiz.hasGeneratedQuizzes,
    handleSummaryMouseUp, handleTranscriptMouseUp: transcript.handleTranscriptMouseUp,
  };
}
