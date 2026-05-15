import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Youtube, Sparkles, Loader2, RotateCcw, ChevronLeft, AlertCircle, Copy, Download, Share2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { youtubeService, TranscriptSegment } from '../services/youtubeService';
import { VideoNoteEditor, VideoNoteEditorRef } from '../components/youtube/VideoNoteEditor';
import { MindMapViewer } from '../components/mindmap/MindMapViewer';
import { Flashcards } from '../components/study/Flashcards';
import { DocumentQuiz } from '../components/quiz/DocumentQuiz';
import { ChatPanel, ChatPanelRef } from '../components/ai/ChatPanel';
import { SummaryPanel } from '../components/study/SummaryPanel';
import { WorkedProblemsPanel } from '../components/WorkedProblemsPanel';
import { TextSelectionToolbar } from '../components/document/TextSelectionToolbar';
import { cn } from '../utils/cn';
import { TABS } from '../constants/tab';
import { QuizQuestion } from '../types';
import { ShareModal } from '../components/common/ShareModal';
import { ShareableQuiz, ShareableCard } from '../services/shareContentService';
import { getApiErrorCode } from '../utils/apiError';

function parseVideoId(url: string): string | null {
	const patterns = [
		/[?&]v=([^&]+)/,
		/youtu\.be\/([^?&/]+)/,
		/youtube\.com\/shorts\/([^?&/]+)/,
		/youtube\.com\/embed\/([^?&/]+)/,
	];
	for (const p of patterns) {
		const m = url.match(p);
		if (m) return m[1];
	}
	return null;
}

interface SimpleCard {
	id: string;
	front: string;
	back: string;
}

interface ChatMsg {
	id: string;
	role: 'user' | 'model';
	content: string;
	isError?: boolean;
}

type VideoStudyTab = 'summary' | 'mindmap' | 'notes' | 'flashcards' | 'quiz' | 'problems' | 'chat';
type QuizDifficulty = 'easy' | 'medium' | 'hard';

const emptyQuizSets = (): Record<QuizDifficulty, QuizQuestion[]> => ({ easy: [], medium: [], hard: [] });
const emptyAnswerSets = (): Record<QuizDifficulty, Record<string, string>> => ({ easy: {}, medium: {}, hard: {} });
const emptySubmittedSets = (): Record<QuizDifficulty, boolean> => ({ easy: false, medium: false, hard: false });
const emptyScoreSets = (): Record<QuizDifficulty, number> => ({ easy: 0, medium: 0, hard: 0 });

interface YouTubeDetailLocationState {
	activeTab?: VideoStudyTab;
	returnTo?: string;
}

export const YouTubeDetailPage: React.FC<{ embedded?: boolean; id?: string }> = ({ embedded, id: propId }) => {
	const { id: paramId } = useParams<{ id: string }>();
	const id = propId ?? paramId;
	const navigate = useNavigate();
	const location = useLocation();
	const locationState = location.state as YouTubeDetailLocationState | null;

	// Video URL (loaded from API)
	const [videoUrl, setVideoUrl] = useState<string | null>(null);
	const [videoTitle, setVideoTitle] = useState<string | null>(null);
	const videoId = videoUrl ? parseVideoId(videoUrl) : null;

	// Page loading state
	const [isLoadingVideo, setIsLoadingVideo] = useState(true);

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

	// Summary text selection toolbar
	const summaryRef = useRef<HTMLDivElement>(null);
	const [summaryToolbar, setSummaryToolbar] = useState<{ x: number; y: number; text: string } | null>(null);

	// Transcript text selection toolbar
	const transcriptRef = useRef<HTMLDivElement>(null);
	const [transcriptToolbar, setTranscriptToolbar] = useState<{ x: number; y: number; text: string } | null>(null);

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

	// Load video record on mount
	useEffect(() => {
		if (id) loadVideoFromApi(id);
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

	const loadVideoFromApi = async (videoRecordId: string) => {
		setIsLoadingVideo(true);
		try {
			const v = await youtubeService.getVideo(videoRecordId);
			setSummary(v.summary ?? null);
			setMindMapText(v.mindMapText ?? null);
			setVideoUrl(v.videoUrl);
			setVideoTitle(v.title ?? null);

			try {
				const cards = await youtubeService.getFlashcards(videoRecordId);
				setFlashcards(cards.map((c, i) => ({ id: `fc-${i}`, front: c.front, back: c.back })));
			} catch { }

			try {
				const questions = await youtubeService.getQuiz(videoRecordId);
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
				setQuizQuestionSets(grouped);
				setQuizQuestions(grouped[activeQuizDifficulty]);
			} catch { }

			try {
				const note = await youtubeService.getVideoNote(videoRecordId);
				if (note) {
					setNoteContent(note.content);
					setNoteId(note.noteId);
				}
			} catch { }

			try {
				const submission = await youtubeService.getQuizSubmission(videoRecordId);
				if (submission) {
					setUserAnswers(submission.answers);
					setQuizAnswerSets(prev => ({ ...prev, [activeQuizDifficulty]: submission.answers }));
					setQuizScore(submission.score);
					setQuizScoreSets(prev => ({ ...prev, [activeQuizDifficulty]: submission.score }));
					setIsQuizSubmitted(true);
					setQuizSubmittedSets(prev => ({ ...prev, [activeQuizDifficulty]: true }));
				}
			} catch { }

			try {
				const history = await youtubeService.getChatHistory(videoRecordId);
				setChatMessages(history);
			} catch { }

		} catch {
			navigate('/youtube');
		} finally {
			setIsLoadingVideo(false);
		}
	};

	// Fetch transcript when video loads
	useEffect(() => {
		if (!videoId || !videoUrl) return;
		setResolvedSubtitlesVideoId(null);
		setSubtitles(null);
		setSubtitlesError(null);
		doFetchSubtitles(videoId).then(() => doFetchTranscript(videoId));
	}, [videoId]);

	const seekTo = (seconds: number) => {
		iframeRef.current?.contentWindow?.postMessage(
			JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
			'*'
		);
	};

	const doFetchTranscript = async (vid: string) => {
		setIsLoadingTranscript(true);
		setTranscriptError(null);
		try {
			const segments = await youtubeService.getTranscript(vid);
			setTranscript(segments.length > 0 ? segments : null);
		} catch (err: any) {
			const msg = err?.response?.data?.message ?? 'No captions available for this video.';
			setTranscriptError(msg);
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
			const segments = await youtubeService.getSubtitles(vid);
			setSubtitles(segments.length > 0 ? segments : null);
		} catch (err: any) {
			const msg = err?.response?.data?.message ?? 'No captions available for this video.';
			setSubtitlesError(msg);
			setSubtitles(null);
		} finally {
			setResolvedSubtitlesVideoId(vid);
			setIsLoadingSubtitles(false);
		}
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

	const fmtTime = (sec: number) => {
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	};

	const fmtSrtTime = (sec: number) => {
		const h = Math.floor(sec / 3600);
		const m = Math.floor((sec % 3600) / 60);
		const s = Math.floor(sec % 60);
		const ms = Math.round((sec % 1) * 1000);
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
	};

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

	const generationDisabled = !videoId || resolvedSubtitlesVideoId !== videoId;
	const generationDisabledReason = 'Waiting for subtitles to finish loading.';

	const doGenerateSummary = async (url: string) => {
		if (generationDisabled) return;
		setSummaryError(null);
		setIsLoadingSummary(true);
		setSummaryStreamText('');
		try {
			let accumulated = '';
			await youtubeService.streamSummary(url, (chunk) => {
				accumulated += chunk;
				setSummaryStreamText(accumulated);
			});
			setSummary(accumulated || null);
			setSummaryStreamText('');
			if (id && accumulated) {
				await youtubeService.updateVideo(id, { summary: accumulated });
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
			await aiService.streamMindMapFromYouTube(
				videoUrl,
				(chunk) => {
					accum.current += chunk;
					setMindMapStreamingText(accum.current);
				},
			);
			const result = accum.current;
			setMindMapText(result);
			setMindMapStreamingText(null);
			if (id) {
				await youtubeService.updateVideo(id, { mindMapText: result });
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
			const cards = await youtubeService.generateFlashcards(id, videoUrl);
			setFlashcards(cards.map((c, i) => ({ id: `fc-${i}`, front: c.front, back: c.back })));
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
			const questions = await youtubeService.generateQuiz(id, videoUrl, difficulty);
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
				await youtubeService.updateNote(noteId, html);
			} else {
				const note = await youtubeService.createNote(html, id);
				setNoteId(note.noteId);
			}
		} catch { }
	}, [id, noteId]);

	const sendChatMessage = useCallback(async (message: string) => {
		if (!id) return;
		const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: message };
		setChatMessages(prev => [...prev, userMsg]);
		try {
			const reply = await youtubeService.sendChat(id, message);
			setChatMessages(prev => [...prev, { ...reply, id: reply.id ?? String(Date.now() + 1) }]);
		} catch (err: any) {
			const errMsg: ChatMsg = { id: String(Date.now() + 1), role: 'model', content: err?.message ?? 'Failed to send message. Please try again.', isError: true };
			setChatMessages(prev => [...prev, errMsg]);
		}
	}, [id]);

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
				await youtubeService.submitQuiz(id, userAnswers, score, quizQuestions.length);
			} catch { }
		}
	}, [quizQuestions, userAnswers, id, activeQuizDifficulty]);

	const handleSummaryMouseUp = useCallback(() => {
		const selection = window.getSelection();
		const text = selection?.toString().trim();
		if (!text || !selection?.rangeCount) { setSummaryToolbar(null); return; }
		const range = selection.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		setSummaryToolbar({ x: rect.left + rect.width / 2, y: rect.top - 12, text });
	}, []);

	const handleTranscriptMouseUp = useCallback(() => {
		const selection = window.getSelection();
		const text = selection?.toString().trim();
		if (!text || !selection?.rangeCount) { setTranscriptToolbar(null); return; }
		const range = selection.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		setTranscriptToolbar({ x: rect.left + rect.width / 2, y: rect.top - 12, text });
	}, []);

	// ─── Study Panel ─────────────────────────────────────────────────────────
	const studyPanel = (
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
					{/* Summary */}
					<div className={cn('h-full', activeTab !== 'summary' && 'hidden')}>
						<SummaryPanel
							summary={summary}
							isLoading={isLoadingSummary}
							onGenerate={generateSummary}
							loadingText="AI is analyzing the video…"
							emptyText="Generate an AI summary of this video."
							error={summaryError}
							onRetry={generateSummary}
							streamingText={summaryStreamText}
							summaryRef={summaryRef}
							onMouseUp={handleSummaryMouseUp}
							onTimelineSeek={seekTo}
							generateDisabled={generationDisabled}
							generateDisabledReason={generationDisabledReason}
						/>
					</div>

					{/* Mind Map */}
					<div className={cn('h-full', activeTab !== 'mindmap' && 'hidden')}>
						<MindMapViewer
							mindMapText={mindMapText}
							onGenerate={generateMindMap}
							isGenerating={isLoadingMindMap}
							streamingText={mindMapStreamingText}
							externalError={mindMapError}
							title={videoId ?? 'mindmap'}
							generateDisabled={generationDisabled}
							generateDisabledReason={generationDisabledReason}
						/>
					</div>

					{/* Notes */}
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
								Load a video to start taking notes.
							</div>
						)}
					</div>

					{/* Flashcards */}
					<div className={cn('h-full', activeTab !== 'flashcards' && 'hidden')}>
						<Flashcards
							externalCards={flashcards}
							onExternalGenerate={generateFlashcards}
							isExternalGenerating={isLoadingFlashcards}
							externalError={flashcardsError}
							generateDisabled={generationDisabled}
							generateDisabledReason={generationDisabledReason}
						/>
					</div>

					{/* Quiz */}
					<div className={cn('h-full overflow-y-auto', activeTab !== 'quiz' && 'hidden')}>
						<DocumentQuiz
							externalQuestions={quizQuestions}
							externalQuestionCounts={{
								easy: quizQuestionSets.easy.length,
								medium: quizQuestionSets.medium.length,
								hard: quizQuestionSets.hard.length,
							}}
							externalUserAnswers={userAnswers}
							externalSubmitted={isQuizSubmitted}
							externalScore={quizScore}
							isExternalLoading={isLoadingQuiz}
							externalError={quizError}
							onExternalGenerate={generateQuiz}
							onExternalDifficultyChange={handleQuizDifficultyChange}
							generateDisabled={generationDisabled}
							generateDisabledReason={generationDisabledReason}
							onExternalAnswer={(qId, option) => {
								if (!isQuizSubmitted) {
									setUserAnswers(prev => ({ ...prev, [qId]: option }));
									setQuizAnswerSets(prev => ({
										...prev,
										[activeQuizDifficulty]: { ...prev[activeQuizDifficulty], [qId]: option },
									}));
								}
							}}
							onExternalSubmit={submitQuiz}
						/>
					</div>

					{/* Problems */}
					<div className={cn('h-full overflow-y-auto', activeTab !== 'problems' && 'hidden')}>
						{id && activeTab === 'problems' && (
							<WorkedProblemsPanel videoId={id} generateDisabled={generationDisabled} generateDisabledReason={generationDisabledReason} />
						)}
					</div>
				</div>

				{/* AI Chat */}
				<div className={cn('flex-1 overflow-hidden', activeTab !== 'chat' && 'hidden')}>
					<ChatPanel
						ref={chatPanelRef}
						externalMessages={chatMessages}
						onExternalStreamSend={async (message, onChunk) => {
							if (!id) return;
							const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: message };
							setChatMessages(prev => [...prev, userMsg]);
							let accumulated = '';
							try {
								await youtubeService.streamChat(id, message, (chunk) => {
									accumulated += chunk;
									onChunk(chunk);
								});
								setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: accumulated }]);
							} catch (err) {
								setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'model', content: getApiErrorCode(err), isError: true }]);
								throw err;
							}
						}}
						onExternalAddToNote={(html) => {
							noteEditorRef.current?.appendContent(html);
							setActiveTab('notes');
						}}
						placeholder="Ask anything about the video…"
					/>
				</div>
			</div>
		</div>
	);

	// ════════════════════════════════════════════════════════════
	//  RENDER
	// ════════════════════════════════════════════════════════════

	if (isLoadingVideo) {
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
				{/* Compact header */}
				{!embedded && (
					<div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)]">
						<button
							onClick={handleBack}
							className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors shrink-0"
						>
							<ChevronLeft size={16} />
						</button>
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500 text-white shrink-0">
							<Youtube size={14} />
						</div>
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium text-text-main truncate">
								{videoTitle ?? videoUrl ?? ''}
							</p>
						</div>
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
					{/* Left – Video + Transcript */}
					<div className={cn(
						'flex-1 flex flex-col overflow-hidden transition-opacity duration-300',
						activeView === 'video' ? 'opacity-100' : 'opacity-0 lg:opacity-100',
					)}>
						{/* Video 16:9, max 55vh */}
						<div className="w-full bg-black shrink-0" style={{ aspectRatio: '16 / 9', maxHeight: '55vh' }}>
							{videoId && (
								<iframe
									id="youtube-player"
									ref={iframeRef}
									src={`https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`}
									title="YouTube video player"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
									allowFullScreen
									className="w-full h-full"
								/>
							)}
						</div>

						{/* Transcript / Subtitles */}
						<div className="flex-1 flex flex-col overflow-hidden border-t border-[var(--border-color)]">
							{/* Tab bar */}
							<div className="flex items-center justify-between px-5 border-b border-[var(--border-color)] shrink-0 bg-[var(--bg-sidebar)]">
								<div className="flex items-center gap-1">
									{(['transcript', 'subtitles'] as const).map(view => (
										<button
											key={view}
											onClick={() => {
												setCenterView(view);
												if (view === 'subtitles' && !subtitles && !subtitlesError && !isLoadingSubtitles && videoId) {
													doFetchSubtitles(videoId);
												}
											}}
											className={cn(
												'px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] border-b-2 transition-colors',
												centerView === view
													? 'border-[var(--primary)] text-[var(--primary)]'
													: 'border-transparent text-text-muted hover:text-text-main',
											)}
										>
											{view === 'transcript' ? 'Transcript' : 'Subtitles'}
										</button>
									))}
								</div>
								{centerView === 'transcript' && transcript && (
									<div className="flex items-center gap-1">
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
										<button onClick={() => videoId && doFetchTranscript(videoId)} disabled={isLoadingTranscript} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
											<RotateCcw size={11} className={isLoadingTranscript ? 'animate-spin' : ''} /> Refresh
										</button>
									</div>
								)}
								{centerView === 'transcript' && !transcript && transcriptError && (
									<button onClick={() => videoId && doFetchTranscript(videoId)} disabled={isLoadingTranscript} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
										<RotateCcw size={11} className={isLoadingTranscript ? 'animate-spin' : ''} /> Refresh
									</button>
								)}
								{centerView === 'subtitles' && (subtitles || subtitlesError) && (
									<button onClick={() => videoId && doFetchSubtitles(videoId)} disabled={isLoadingSubtitles} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-medium text-text-muted hover:bg-zinc-100 transition-colors disabled:opacity-50">
										<RotateCcw size={11} className={isLoadingSubtitles ? 'animate-spin' : ''} /> Refresh
									</button>
								)}
							</div>

							{/* Transcript view */}
							<div ref={transcriptRef} className={cn('flex-1 overflow-y-auto select-text', centerView !== 'transcript' && 'hidden')} onMouseUp={handleTranscriptMouseUp}>
								{isLoadingTranscript ? (
									<div className="flex flex-col items-center justify-center h-full gap-3 text-center">
										<Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
										<p className="text-xs text-zinc-400">Fetching captions…</p>
									</div>
								) : transcript ? (
									<div className="divide-y divide-[var(--border-color)]">
										{transcript.map((chunk, i) => {
											const totalSec = Math.floor(chunk.startSeconds);
											const m = Math.floor(totalSec / 60);
											const s = totalSec % 60;
											const label = `${m}:${String(s).padStart(2, '0')}`;
											return (
												<button
													key={i}
													onClick={() => seekTo(chunk.startSeconds)}
													className="w-full flex items-start gap-3 px-5 py-2.5 text-left hover:bg-[var(--primary)]/5 transition-colors group"
												>
													<span className="shrink-0 mt-0.5 min-w-[2.75rem] rounded-md bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
														{label}
													</span>
													<span className="text-xs text-text-main leading-relaxed">{chunk.text}</span>
												</button>
											);
										})}
									</div>
								) : transcriptError ? (
									<div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
										<div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
											<AlertCircle size={20} />
										</div>
										<div>
											<p className="text-xs font-semibold text-text-main">Captions unavailable</p>
											<p className="mt-1 text-[11px] text-zinc-400">{transcriptError}</p>
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center h-full gap-3 text-center">
										<Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
										<p className="text-xs text-zinc-400">Loading transcript…</p>
									</div>
								)}
							</div>

							{/* Subtitles view */}
							<div className={cn('flex-1 overflow-y-auto select-text', centerView !== 'subtitles' && 'hidden')}>
								{isLoadingSubtitles ? (
									<div className="flex flex-col items-center justify-center h-full gap-3 text-center">
										<Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
										<p className="text-xs text-zinc-400">Fetching subtitles…</p>
									</div>
								) : subtitles ? (
									<div className="divide-y divide-[var(--border-color)]">
										{subtitles.map((line, i) => {
											const totalSec = Math.floor(line.startSeconds);
											const m = Math.floor(totalSec / 60);
											const s = totalSec % 60;
											const label = `${m}:${String(s).padStart(2, '0')}`;
											return (
												<button
													key={i}
													onClick={() => seekTo(line.startSeconds)}
													className="w-full flex items-start gap-3 px-5 py-2 text-left hover:bg-[var(--primary)]/5 transition-colors group"
												>
													<span className="shrink-0 mt-0.5 min-w-[2.75rem] rounded-md bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
														{label}
													</span>
													<span className="text-xs text-text-main leading-relaxed">{line.text}</span>
												</button>
											);
										})}
									</div>
								) : subtitlesError ? (
									<div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
										<div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
											<AlertCircle size={20} />
										</div>
										<div>
											<p className="text-xs font-semibold text-text-main">Subtitles unavailable</p>
											<p className="mt-1 text-[11px] text-zinc-400">{subtitlesError}</p>
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
										<p className="text-xs text-zinc-400">Click Subtitles to load the original caption lines.</p>
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
				<div className="flex h-16 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:hidden shrink-0">
					<button onClick={() => setActiveView('study')} className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'study' ? 'text-[var(--primary)]' : 'text-text-muted')}>
						<Sparkles size={20} /><span className="text-[10px] font-bold uppercase tracking-wider">Study</span>
					</button>
					<button onClick={() => setActiveView('video')} className={cn('flex flex-1 flex-col items-center justify-center gap-1 transition-colors', activeView === 'video' ? 'text-[var(--primary)]' : 'text-text-muted')}>
						<Youtube size={20} /><span className="text-[10px] font-bold uppercase tracking-wider">Video</span>
					</button>
				</div>
			</motion.div>

			{/* Summary text selection toolbar */}
			{summaryToolbar && (
				<TextSelectionToolbar
					x={summaryToolbar.x}
					y={summaryToolbar.y}
					selectedText={summaryToolbar.text}
					onClose={() => setSummaryToolbar(null)}
					onAddNoteText={(text) => {
						noteEditorRef.current?.appendContent(`<p>${text}</p>`);
						setActiveTab('notes');
						setActiveView('study');
						setSummaryToolbar(null);
					}}
					onAskAI={(text) => {
						chatPanelRef.current?.setInput(text);
						setActiveTab('chat');
						setActiveView('study');
						setSummaryToolbar(null);
					}}
				/>
			)}

			{/* Transcript text selection toolbar */}
			{transcriptToolbar && (
				<TextSelectionToolbar
					x={transcriptToolbar.x}
					y={transcriptToolbar.y}
					selectedText={transcriptToolbar.text}
					onClose={() => setTranscriptToolbar(null)}
					onAddNoteText={(text) => {
						noteEditorRef.current?.appendContent(`<p>${text}</p>`);
						setActiveTab('notes');
						setActiveView('study');
						setTranscriptToolbar(null);
					}}
					onAskAI={(text) => {
						chatPanelRef.current?.setInput(text);
						setActiveTab('chat');
						setActiveView('study');
						setTranscriptToolbar(null);
					}}
				/>
			)}

			<ShareModal
				open={showShareModal}
				onClose={() => setShowShareModal(false)}
				title={videoTitle ?? videoUrl ?? 'YouTube Video'}
				summary={summary}
				mindMapText={mindMapText}
				notesHtml={noteContent || null}
				sourceType="youtube"
				sourceUrl={videoUrl}
				fetchQuizzes={id ? async () => {
					const qs = await youtubeService.getQuiz(id);
					return qs.map(q => ({
						question: q.question,
						options: q.options ?? [],
						correctAnswer: q.correctAnswer,
						explanation: q.explanation ?? '',
						difficulty: q.difficulty ?? 'medium',
					} satisfies ShareableQuiz));
				} : undefined}
				fetchFlashcards={flashcards.length > 0 ? async () =>
					flashcards.map(c => ({ front: c.front, back: c.back } satisfies ShareableCard))
					: undefined}
			/>
		</div>
	);
};


function isOptionCorrect(option: string, answer: string): boolean {
	if (option === answer) return true;
	const letter = option.match(/^([A-D])[).:\s]/i)?.[1]?.toUpperCase();
	return letter !== undefined && letter === answer.trim().toUpperCase();
}
