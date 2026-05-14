import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { STUDY_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { Course, Document, Flashcard, GlossaryTerm, Note } from '../../types';
import { HardFlashcardReview } from '../study/HardFlashcardCard';
import { SessionRating } from '../study/FlashcardSessionCard';
import { VideoListItem, youtubeService } from '../../services/youtubeService';
import { WorkedProblem, workedProblemsService } from '../../services/workedProblemsService';
import { QuestionBankQuestion } from '../../services/questionBankService';
import { documentService, quizSubmissionService, QuizSubmission } from '../../services/documentService';
import { aiService, ChatSessionSummary } from '../../services/aiService';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';
import { masteredService } from '../../services/masteredService';
import { useAuth } from '../../context/AuthContext';
import { getApiErrorCode } from '../../utils/apiError';
import { cn } from '../../utils/cn';
import { SummaryMarkdown } from '../study/SummaryMarkdown';
import { MindMapViewer } from '../mindmap/MindMapViewer';
import { ChatPanel } from '../ai/ChatPanel';
import { ArtifactKind, ArtifactSection } from './ArtifactSection';

export type CourseStudySelected =
  | { kind: 'doc'; data: Document }
  | { kind: 'video'; data: VideoListItem }
  | null;

export interface CourseArtifacts {
  notes: Note[];
  flashcards: Flashcard[];
  questions: QuestionBankQuestion[];
  glossary: GlossaryTerm[];
  workedProblems: WorkedProblem[];
}

interface CourseArtifactsWorkspaceProps {
  course: Course | null;
  documents: Document[];
  videos: VideoListItem[];
  selected: CourseStudySelected;
  setSelected: (selected: CourseStudySelected) => void;
  artifacts: CourseArtifacts;
  loading: boolean;
}

type SourceRow = {
  key: string;
  title: string;
  sourceKind: 'doc' | 'video';
  documentId?: string;
  videoId?: string;
  videoUrl?: string;
  mindMapText: string | null;
  summary: string | null | undefined;
};

type ArtifactDetail =
  | { kind: 'summaries'; itemKey: string; type: 'summary'; title: string; content: string }
  | { kind: 'notes'; itemKey: string; type: 'note'; title: string; content: string }
  | { kind: 'flashcards'; itemKey: string; type: 'flashcard'; title: string; front: string; back: string }
  | { kind: 'questions'; itemKey: string; type: 'question'; title: string; question: QuestionBankQuestion; userAnswer?: string }
  | { kind: 'glossary'; itemKey: string; type: 'glossary'; title: string; term: GlossaryTerm }
  | { kind: 'workedProblems'; itemKey: string; type: 'problem'; title: string; problem: WorkedProblem }
  | { kind: 'mindmaps'; itemKey: string; type: 'mindmap'; title: string; sourceKind: 'doc' | 'video'; documentId?: string; videoId?: string; videoUrl?: string; initialMindMapText: string | null }
  | { kind: 'chats'; itemKey: string; type: 'chat'; title: string; sourceKind: 'doc' | 'video'; documentId?: string; videoId?: string }
  | null;

type OpenArtifactDetail = Exclude<ArtifactDetail, null>;
type ExternalMsg = { id: string; role: 'user' | 'model'; content: string; isError?: boolean };

const ARTIFACT_PAGE_SIZE = 6;
const FLASHCARD_PAGE_SIZE = 6;

const initialSectionPages: Record<ArtifactKind, number> = {
  summaries: 1,
  notes: 1,
  flashcards: 1,
  questions: 1,
  glossary: 1,
  workedProblems: 1,
  mindmaps: 1,
  chats: 1,
};

const stripHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const hasHtmlMarkup = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value);

const ArtifactContent: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  if (hasHtmlMarkup(value)) {
    return (
      <div
        className={cn('prose prose-sm max-w-none', className)}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }
  return (
    <div className={cn('prose prose-sm max-w-none artifact-markdown', className)}>
      <SummaryMarkdown value={value} />
    </div>
  );
};

const getDocKind = (doc: Document): 'document' | 'article' | 'audio' =>
  doc.type === 'audio' || doc.type === 'podcast' ? 'audio' : doc.originalUrl ? 'article' : 'document';

const sourceKeyForSelected = (selected: CourseStudySelected): string | null =>
  selected ? `${selected.kind}:${selected.data.id}` : null;

const ArtifactMetric: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, value, color, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-xl border bg-white p-3 text-left transition-all hover:-translate-y-px hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30',
      active ? 'border-primary shadow-sm' : 'border-[var(--border-color)]',
    )}
  >
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums text-text-main">{value}</p>
        <p className="text-[11px] font-semibold text-text-muted">{label}</p>
      </div>
    </div>
  </button>
);

export const CourseArtifactsWorkspace: React.FC<CourseArtifactsWorkspaceProps> = ({
  course,
  documents,
  videos,
  selected,
  setSelected,
  artifacts,
  loading,
}) => {
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';

  const [artifactFilter, setArtifactFilter] = useState<'all' | 'current'>('all');
  const [activeArtifact, setActiveArtifact] = useState<ArtifactKind | null>(null);
  const [detail, setDetail] = useState<ArtifactDetail>(null);
  const [sectionPages, setSectionPages] = useState<Record<ArtifactKind, number>>(initialSectionPages);

  // Flashcard difficulty filter
  const [flashcardDifficultyFilter, setFlashcardDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [flashcardDifficultyOverrides, setFlashcardDifficultyOverrides] = useState<Map<string, Flashcard['difficulty']>>(new Map());

  // Quiz mistake filter
  const [questionFilter, setQuestionFilter] = useState<'all' | 'mistakes'>('all');
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);

  // Answer reveal toggle — reset whenever the detail changes
  const [revealAnswers, setRevealAnswers] = useState(false);

  // Glossary mastered filter
  const [glossaryFilter, setGlossaryFilter] = useState<'all' | 'unmastered'>('all');
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => masteredService.getCached(userId));
  const [togglingGlossaryId, setTogglingGlossaryId] = useState<string | null>(null);

  // Worked problem mastered filter
  const [workedProblemFilter, setWorkedProblemFilter] = useState<'all' | 'unmastered'>('all');
  const [masteredProblemIds, setMasteredProblemIds] = useState<Set<string>>(new Set());
  const [togglingProblemId, setTogglingProblemId] = useState<string | null>(null);

  // Mind map state (tied to the open detail modal)
  const [mmText, setMmText] = useState<string | null>(null);
  const [mmGenerating, setMmGenerating] = useState(false);
  const [mmStreaming, setMmStreaming] = useState<string | null>(null);
  const [mmError, setMmError] = useState<string | null>(null);

  // Chat state (tied to the open detail modal)
  const [chatMessages, setChatMessages] = useState<ExternalMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatDetailKeyRef = useRef('');

  // Pre-loaded chat sessions to know which materials have history
  const [chatSessions, setChatSessions] = useState<Map<string, ChatSessionSummary>>(new Map());

  const selectedKey = sourceKeyForSelected(selected);
  const docMap = useMemo(() => new Map(documents.map(d => [d.id, d])), [documents]);
  const videoMap = useMemo(() => new Map(videos.map(v => [v.id, v])), [videos]);

  const artifactBuckets = useMemo(() => {
    const matchesSource = (documentId?: string | null, videoId?: string | null) => {
      if (artifactFilter !== 'current' || !selected) return true;
      return selected.kind === 'doc'
        ? documentId === selected.data.id
        : videoId === selected.data.id;
    };
    return {
      notes: artifacts.notes.filter(n => matchesSource(n.documentId, n.youTubeVideoId)),
      flashcards: artifacts.flashcards.filter(f => matchesSource(f.documentId, f.youTubeVideoId)),
      questions: artifacts.questions.filter(q => matchesSource(q.documentId, q.youTubeVideoId)),
      glossary: artifacts.glossary.filter(g => matchesSource(g.documentId, g.youTubeVideoId)),
      workedProblems: artifacts.workedProblems.filter(p => matchesSource(p.documentId, p.youTubeVideoId)),
    };
  }, [artifacts, artifactFilter, selected]);

  // Reset difficulty overrides when artifacts reload (course/filter change)
  useEffect(() => {
    setFlashcardDifficultyOverrides(new Map());
  }, [artifacts.flashcards]);

  // Load quiz submissions to power the mistake filter
  useEffect(() => {
    quizSubmissionService.getAllSubmissions(1, 200)
      .then(p => setQuizSubmissions(p.items))
      .catch(() => { });
  }, []);

  const failedQuestionIds = useMemo<Set<string>>(() => {
    const byId = new Map(artifactBuckets.questions.map(q => [q.quizId, q]));
    const everCorrect = new Set<string>();
    const everWrong = new Set<string>();
    for (const submission of quizSubmissions) {
      for (const [quizId, selectedAnswer] of Object.entries(submission.answers ?? {})) {
        if (!byId.has(quizId)) continue;
        const question = byId.get(quizId)!;
        if (selectedAnswer && isQuizOptionCorrect(selectedAnswer, question.correctAnswer)) {
          everCorrect.add(quizId);
        } else {
          everWrong.add(quizId);
        }
      }
    }
    for (const id of everCorrect) everWrong.delete(id);
    return everWrong;
  }, [artifactBuckets.questions, quizSubmissions]);

  // Maps quizId → the last wrong answer the user selected (for the eye button reveal)
  const userAnswerMap = useMemo<Map<string, string>>(() => {
    const byId = new Map(artifactBuckets.questions.map(q => [q.quizId, q]));
    const wrong = new Map<string, string>();
    for (const submission of quizSubmissions) {
      for (const [quizId, selectedAnswer] of Object.entries(submission.answers ?? {})) {
        if (!byId.has(quizId) || !selectedAnswer) continue;
        const question = byId.get(quizId)!;
        if (!isQuizOptionCorrect(selectedAnswer, question.correctAnswer)) {
          wrong.set(quizId, selectedAnswer);
        }
      }
    }
    return wrong;
  }, [artifactBuckets.questions, quizSubmissions]);

  const filteredFlashcards = useMemo(() => {
    const withOverrides = artifactBuckets.flashcards.map(c => {
      const override = flashcardDifficultyOverrides.get(c.id);
      return override ? { ...c, difficulty: override } : c;
    });
    if (flashcardDifficultyFilter === 'all') return withOverrides;
    return withOverrides.filter(c => c.difficulty === flashcardDifficultyFilter);
  }, [artifactBuckets.flashcards, flashcardDifficultyFilter, flashcardDifficultyOverrides]);

  useEffect(() => {
    setSectionPages(prev => ({ ...prev, flashcards: 1 }));
  }, [flashcardDifficultyFilter]);

  const filteredQuestions = useMemo(() => {
    if (questionFilter === 'all') return artifactBuckets.questions;
    return artifactBuckets.questions.filter(q => failedQuestionIds.has(q.quizId));
  }, [artifactBuckets.questions, questionFilter, failedQuestionIds]);

  useEffect(() => {
    setSectionPages(prev => ({ ...prev, questions: 1 }));
  }, [questionFilter]);

  // Load mastered IDs from server for unmastered filter
  useEffect(() => {
    masteredService.loadFromServer(userId)
      .then(ids => setMasteredIds(ids))
      .catch(() => { });
  }, [userId]);

  // Load mastered worked problem IDs
  useEffect(() => {
    workedProblemsService.getMastered()
      .then(ids => setMasteredProblemIds(ids))
      .catch(() => { });
  }, [userId]);

  const filteredGlossary = useMemo(() => {
    if (glossaryFilter === 'all') return artifactBuckets.glossary;
    return artifactBuckets.glossary.filter(t => !masteredIds.has(t.id));
  }, [artifactBuckets.glossary, glossaryFilter, masteredIds]);

  useEffect(() => {
    setSectionPages(prev => ({ ...prev, glossary: 1 }));
  }, [glossaryFilter]);

  const filteredWorkedProblems = useMemo(() => {
    if (workedProblemFilter === 'all') return artifactBuckets.workedProblems;
    return artifactBuckets.workedProblems.filter(p => !masteredProblemIds.has(p.workedProblemId));
  }, [artifactBuckets.workedProblems, workedProblemFilter, masteredProblemIds]);

  useEffect(() => {
    setSectionPages(prev => ({ ...prev, workedProblems: 1 }));
  }, [workedProblemFilter]);

  const handleFlashcardRateInArtifacts = useCallback((cardId: string, rating: SessionRating) => {
    const newDifficulty: Flashcard['difficulty'] = rating === 4 ? 'easy' : rating === 3 ? 'medium' : 'hard';
    setFlashcardDifficultyOverrides(prev => new Map(prev).set(cardId, newDifficulty));
  }, []);

  const handleToggleMastered = useCallback(async (termId: string) => {
    if (togglingGlossaryId) return;
    setTogglingGlossaryId(termId);
    setMasteredIds(prev => {
      const next = new Set(prev);
      next.has(termId) ? next.delete(termId) : next.add(termId);
      masteredService.updateCache(userId, next);
      return next;
    });
    try {
      await masteredService.toggle(userId, termId);
    } catch {
      // revert optimistic update
      setMasteredIds(prev => {
        const next = new Set(prev);
        next.has(termId) ? next.delete(termId) : next.add(termId);
        masteredService.updateCache(userId, next);
        return next;
      });
    } finally {
      setTogglingGlossaryId(null);
    }
  }, [togglingGlossaryId, userId]);

  const handleToggleProblemMastered = useCallback(async (problemId: string) => {
    if (togglingProblemId) return;
    setTogglingProblemId(problemId);
    setMasteredProblemIds(prev => {
      const next = new Set(prev);
      next.has(problemId) ? next.delete(problemId) : next.add(problemId);
      return next;
    });
    try {
      await workedProblemsService.toggleMastered(problemId);
    } catch {
      // revert optimistic update
      setMasteredProblemIds(prev => {
        const next = new Set(prev);
        next.has(problemId) ? next.delete(problemId) : next.add(problemId);
        return next;
      });
    } finally {
      setTogglingProblemId(null);
    }
  }, [togglingProblemId]);

  const sourceRows = useMemo<SourceRow[]>(() => [
    ...documents.map(doc => ({
      key: `doc:${doc.id}`,
      title: doc.name,
      sourceKind: 'doc' as const,
      documentId: doc.id,
      videoId: undefined,
      videoUrl: undefined,
      mindMapText: doc.mindMapText ?? null,
      summary: doc.summary,
    })),
    ...videos.map(video => ({
      key: `video:${video.id}`,
      title: video.title,
      sourceKind: 'video' as const,
      documentId: undefined,
      videoId: video.id,
      videoUrl: video.videoUrl,
      mindMapText: null,
      summary: video.summary,
    })),
  ], [documents, videos]);

  const visibleRows = artifactFilter === 'current' && selectedKey
    ? sourceRows.filter(row => row.key === selectedKey)
    : sourceRows;

  const summaryRows = useMemo(() => visibleRows.filter(row => row.summary), [visibleRows]);

  const mindmapRows = useMemo(
    () => visibleRows.filter(row => row.mindMapText),
    [visibleRows],
  );

  const chatRows = useMemo(
    () => visibleRows.filter(row => chatSessions.has(row.documentId ?? row.videoId ?? '')),
    [visibleRows, chatSessions],
  );

  useEffect(() => {
    setSectionPages(initialSectionPages);
  }, [artifactFilter, selectedKey]);

  // Load chat sessions to know which materials have existing conversations
  useEffect(() => {
    if (!course) return;
    aiService.getChatSessions()
      .then(sessions => {
        const map = new Map<string, ChatSessionSummary>();
        sessions.forEach(s => {
          if (s.courseId === course.id) map.set(s.sourceId, s);
        });
        setChatSessions(map);
      })
      .catch(() => { });
  }, [course?.id]);

  // Initialize mind map state when a mindmap detail opens
  useEffect(() => {
    if (!detail || detail.type !== 'mindmap') return;
    setMmError(null);
    setMmStreaming(null);
    setMmGenerating(false);
    setMmText(detail.initialMindMapText);
  }, [detail?.type === 'mindmap' ? detail.itemKey : null]);

  // Load chat history when a chat detail opens
  useEffect(() => {
    if (!detail || detail.type !== 'chat') return;
    if (chatDetailKeyRef.current === detail.itemKey) return;
    chatDetailKeyRef.current = detail.itemKey;
    setChatMessages([]);
    setChatLoading(true);
    if (detail.sourceKind === 'doc' && detail.documentId && course) {
      documentService.getChatHistory(course.id, detail.documentId)
        .then(msgs => setChatMessages(msgs.map(m => ({ id: m.id, role: m.role, content: m.content }))))
        .catch(() => { })
        .finally(() => setChatLoading(false));
    } else if (detail.sourceKind === 'video' && detail.videoId) {
      youtubeService.getChatHistory(detail.videoId)
        .then(msgs => setChatMessages(msgs))
        .catch(() => { })
        .finally(() => setChatLoading(false));
    } else {
      setChatLoading(false);
    }
  }, [detail?.type === 'chat' ? detail.itemKey : null, course]);

  // Reset chat key when modal closes
  useEffect(() => {
    if (!detail) chatDetailKeyRef.current = '';
  }, [detail]);

  // Reset answer reveal whenever the open detail item changes
  useEffect(() => {
    setRevealAnswers(false);
  }, [detail?.itemKey]);

  const handleGenerateMindMap = useCallback(async () => {
    if (!detail || detail.type !== 'mindmap' || !course || mmGenerating) return;
    setMmGenerating(true);
    setMmError(null);
    setMmText(null);
    setMmStreaming('');
    const accum = { current: '' };
    try {
      if (detail.sourceKind === 'doc' && detail.documentId) {
        await documentService.streamMindMap(course.id, detail.documentId, (chunk) => {
          accum.current += chunk;
          setMmStreaming(accum.current);
        });
      } else if (detail.sourceKind === 'video' && detail.videoUrl) {
        await aiService.streamMindMapFromYouTube(detail.videoUrl, (chunk) => {
          accum.current += chunk;
          setMmStreaming(accum.current);
        });
      }
      setMmText(accum.current || null);
    } catch (err) {
      setMmError(getApiErrorCode(err));
    } finally {
      setMmGenerating(false);
      setMmStreaming(null);
    }
  }, [detail, course, mmGenerating]);

  const handleChatStreamSend = useCallback(async (message: string, onChunk: (chunk: string) => void) => {
    if (!detail || detail.type !== 'chat' || !course) throw new Error('No material selected.');
    setChatMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message }]);
    let accumulated = '';
    try {
      if (detail.sourceKind === 'doc' && detail.documentId) {
        await documentService.streamChat(course.id, detail.documentId, message, (chunk) => {
          accumulated += chunk;
          onChunk(chunk);
        });
      } else if (detail.sourceKind === 'video' && detail.videoId) {
        await youtubeService.streamChat(detail.videoId, message, (chunk) => {
          accumulated += chunk;
          onChunk(chunk);
        });
      }
      if (accumulated) {
        setChatMessages(prev => [...prev, { id: `m-${Date.now()}`, role: 'model', content: accumulated }]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get a response.';
      setChatMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'model', content: errMsg, isError: true }]);
      throw err;
    }
  }, [detail, course]);

  const sourceTitle = (documentId?: string | null, videoId?: string | null, fallback = 'Course material') => {
    if (videoId) return videoMap.get(videoId)?.title ?? fallback;
    if (documentId) return docMap.get(documentId)?.name ?? fallback;
    return fallback;
  };

  const setSectionPage = (kind: ArtifactKind, page: number) => {
    setSectionPages(current => ({ ...current, [kind]: Math.max(1, page) }));
  };

  const getPagedItems = <T,>(kind: ArtifactKind, items: T[]) => {
    const totalPages = Math.max(1, Math.ceil(items.length / ARTIFACT_PAGE_SIZE));
    const page = Math.min(sectionPages[kind] ?? 1, totalPages);
    const start = (page - 1) * ARTIFACT_PAGE_SIZE;
    return { items: items.slice(start, start + ARTIFACT_PAGE_SIZE), page, totalPages };
  };

  const pagedNotes = getPagedItems('notes', artifactBuckets.notes);
  const pagedQuestions = getPagedItems('questions', filteredQuestions);

  const flashcardTotalPages = Math.max(1, Math.ceil(filteredFlashcards.length / FLASHCARD_PAGE_SIZE));
  const flashcardPage = Math.min(sectionPages['flashcards'] ?? 1, flashcardTotalPages);
  const flashcardStart = (flashcardPage - 1) * FLASHCARD_PAGE_SIZE;
  const pagedFilteredFlashcards = filteredFlashcards.slice(flashcardStart, flashcardStart + FLASHCARD_PAGE_SIZE);
  const pagedGlossary = getPagedItems('glossary', filteredGlossary);
  const pagedWorkedProblems = getPagedItems('workedProblems', filteredWorkedProblems);
  const pagedSummaries = getPagedItems('summaries', summaryRows);
  const pagedMindmaps = getPagedItems('mindmaps', mindmapRows);
  const pagedChats = getPagedItems('chats', chatRows);

  const buildNoteDetail = (note: Note): OpenArtifactDetail => ({
    kind: 'notes', itemKey: note.id, type: 'note',
    title: sourceTitle(note.documentId, note.youTubeVideoId, note.documentName ?? note.videoName ?? 'Note'),
    content: note.content,
  });

  const buildFlashcardDetail = (card: Flashcard): OpenArtifactDetail => ({
    kind: 'flashcards', itemKey: card.id, type: 'flashcard',
    title: sourceTitle(card.documentId, card.youTubeVideoId, card.documentName ?? card.videoName ?? 'Flashcard'),
    front: card.front, back: card.back,
  });

  const buildQuestionDetail = (question: QuestionBankQuestion): OpenArtifactDetail => ({
    kind: 'questions', itemKey: question.quizId, type: 'question',
    title: sourceTitle(question.documentId, question.youTubeVideoId, question.sourceName ?? 'Question'),
    question,
    userAnswer: userAnswerMap.get(question.quizId),
  });

  const buildGlossaryDetail = (term: GlossaryTerm): OpenArtifactDetail => ({
    kind: 'glossary', itemKey: term.id, type: 'glossary',
    title: sourceTitle(term.documentId, term.youTubeVideoId, term.sourceName ?? 'Glossary'),
    term,
  });

  const buildProblemDetail = (problem: WorkedProblem): OpenArtifactDetail => ({
    kind: 'workedProblems', itemKey: problem.workedProblemId, type: 'problem',
    title: sourceTitle(problem.documentId, problem.youTubeVideoId, problem.topic ?? 'Worked problem'),
    problem,
  });

  const buildSummaryDetail = (row: SourceRow): OpenArtifactDetail => ({
    kind: 'summaries', itemKey: row.key, type: 'summary',
    title: row.title, content: row.summary ?? '',
  });

  const buildMindmapDetail = (row: SourceRow): OpenArtifactDetail => ({
    kind: 'mindmaps', itemKey: row.key, type: 'mindmap',
    title: row.title,
    sourceKind: row.sourceKind,
    documentId: row.documentId,
    videoId: row.videoId,
    videoUrl: row.videoUrl,
    initialMindMapText: row.mindMapText,
  });

  const buildChatDetail = (row: SourceRow): OpenArtifactDetail => ({
    kind: 'chats', itemKey: row.key, type: 'chat',
    title: row.title,
    sourceKind: row.sourceKind,
    documentId: row.documentId,
    videoId: row.videoId,
  });

  const getDetailList = (kind: ArtifactKind): OpenArtifactDetail[] => {
    switch (kind) {
      case 'summaries': return summaryRows.map(buildSummaryDetail);
      case 'notes': return artifactBuckets.notes.map(buildNoteDetail);
      case 'flashcards': return artifactBuckets.flashcards.map(buildFlashcardDetail);
      case 'questions': return artifactBuckets.questions.map(q => buildQuestionDetail(q));
      case 'glossary': return artifactBuckets.glossary.map(buildGlossaryDetail);
      case 'workedProblems': return artifactBuckets.workedProblems.map(buildProblemDetail);
      case 'mindmaps': return mindmapRows.map(buildMindmapDetail);
      case 'chats': return chatRows.map(buildChatDetail);
    }
  };

  const detailItems = detail ? getDetailList(detail.kind) : [];
  const detailIndex = detail ? detailItems.findIndex(item => item.itemKey === detail.itemKey) : -1;
  const detailPosition = detailIndex >= 0 ? detailIndex + 1 : 1;
  const detailCount = detailItems.length;

  const switchDetail = (direction: -1 | 1) => {
    if (!detail || detailItems.length <= 1 || detailIndex < 0) return;
    const nextIndex = (detailIndex + direction + detailItems.length) % detailItems.length;
    setDetail(detailItems[nextIndex]);
  };

  const emptyLine = <p className="text-sm text-text-muted">Nothing generated yet.</p>;

  const handleMetricClick = (kind: ArtifactKind) => {
    setActiveArtifact(kind);
    window.requestAnimationFrame(() => {
      document.getElementById(`artifact-section-${kind}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const isMindmapOrChat = detail?.type === 'mindmap' || detail?.type === 'chat';

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-app)]">
      <div className="mx-auto max-w-7xl space-y-5 p-4 lg:p-6">

        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-text-main">{course?.name ?? 'Course'} artifacts</h1>
            <p className="mt-1 text-sm text-text-muted">Summaries, notes, flashcards, quizzes, glossary, problems, mind maps, and AI chats.</p>
          </div>
          <div className="flex rounded-xl border border-[var(--border-color)] bg-white p-1">
            {(['all', 'current'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setArtifactFilter(mode)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold capitalize',
                  artifactFilter === mode ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main',
                )}
              >
                {mode === 'all' ? 'All materials' : 'Selected only'}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          <ArtifactMetric icon={STUDY_TYPE_ICONS.summary.icon}   label="Summaries" value={sourceRows.filter(r => r.summary).length} color={STUDY_TYPE_ICONS.summary.color}   active={activeArtifact === 'summaries'}     onClick={() => handleMetricClick('summaries')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.notes.icon}     label="Notes"     value={artifacts.notes.length}               color={STUDY_TYPE_ICONS.notes.color}     active={activeArtifact === 'notes'}         onClick={() => handleMetricClick('notes')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.flashcard.icon} label="Flashcards"value={artifacts.flashcards.length}           color={STUDY_TYPE_ICONS.flashcard.color} active={activeArtifact === 'flashcards'}     onClick={() => handleMetricClick('flashcards')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.quiz.icon}      label="Questions" value={artifacts.questions.length}            color={STUDY_TYPE_ICONS.quiz.color}      active={activeArtifact === 'questions'}     onClick={() => handleMetricClick('questions')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.glossary.icon}  label="Glossary"  value={artifacts.glossary.length}             color={STUDY_TYPE_ICONS.glossary.color}  active={activeArtifact === 'glossary'}      onClick={() => handleMetricClick('glossary')} />
          <ArtifactMetric icon={STUDY_TYPE_ICONS.problems.icon}  label="Problems"  value={artifacts.workedProblems.length}        color={STUDY_TYPE_ICONS.problems.color}  active={activeArtifact === 'workedProblems'}onClick={() => handleMetricClick('workedProblems')} />
          {mindmapRows.length > 0 && (
            <ArtifactMetric icon={STUDY_TYPE_ICONS.mindmap.icon} label="Mind Maps" value={mindmapRows.length}                    color={STUDY_TYPE_ICONS.mindmap.color}   active={activeArtifact === 'mindmaps'}      onClick={() => handleMetricClick('mindmaps')} />
          )}
          {chatRows.length > 0 && (
            <ArtifactMetric icon={STUDY_TYPE_ICONS.chat.icon}    label="AI Chats"  value={chatRows.length}                       color={STUDY_TYPE_ICONS.chat.color}      active={activeArtifact === 'chats'}         onClick={() => handleMetricClick('chats')} />
          )}
        </div>

        {!loading && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">

            {/* Notes */}
            <ArtifactSection id="notes" icon={STUDY_TYPE_ICONS.notes.icon} color={STUDY_TYPE_ICONS.notes.color} title="Notes" count={artifactBuckets.notes.length} page={pagedNotes.page} totalPages={pagedNotes.totalPages} onPageChange={page => setSectionPage('notes', page)} activeArtifact={activeArtifact}>
              {artifactBuckets.notes.length === 0 ? emptyLine : pagedNotes.items.map(note => {
                const d = buildNoteDetail(note);
                return (
                  <button key={note.id} onClick={() => setDetail(d)} className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5">
                    <p className="truncate text-sm font-semibold text-text-main">{d.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted">{stripHtml(note.content)}</p>
                  </button>
                );
              })}
            </ArtifactSection>

            {/* Flashcards */}
            <ArtifactSection
              id="flashcards"
              icon={STUDY_TYPE_ICONS.flashcard.icon}
              color={STUDY_TYPE_ICONS.flashcard.color}
              title="Flashcards"
              count={filteredFlashcards.length}
              page={flashcardPage}
              totalPages={flashcardTotalPages}
              onPageChange={page => setSectionPage('flashcards', page)}
              activeArtifact={activeArtifact}
              headerExtra={
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { key: 'all', label: 'All', activeClass: 'bg-zinc-700 text-white' },
                    { key: 'easy', label: 'Easy', activeClass: 'bg-blue-500 text-white' },
                    { key: 'medium', label: 'Medium', activeClass: 'bg-orange-500 text-white' },
                    { key: 'hard', label: 'Hard', activeClass: 'bg-[#059669] text-white' },
                  ] as const).map(({ key, label, activeClass }) => (
                    <button
                      key={key}
                      onClick={() => setFlashcardDifficultyFilter(key)}
                      className={cn(
                        'rounded-full px-3 py-0.5 text-xs font-semibold capitalize transition-colors',
                        flashcardDifficultyFilter === key
                          ? activeClass
                          : 'border border-[var(--border-color)] bg-[var(--bg-app)] text-text-muted hover:text-text-main',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              {pagedFilteredFlashcards.length === 0
                ? emptyLine
                : <HardFlashcardReview key={`${flashcardDifficultyFilter}-${flashcardPage}`} cards={pagedFilteredFlashcards} onRate={handleFlashcardRateInArtifacts} />
              }
            </ArtifactSection>

            {/* Questions */}
            <ArtifactSection
              id="questions"
              icon={STUDY_TYPE_ICONS.quiz.icon}
              color={STUDY_TYPE_ICONS.quiz.color}
              title="Quizzes"
              count={filteredQuestions.length}
              page={pagedQuestions.page}
              totalPages={pagedQuestions.totalPages}
              onPageChange={page => setSectionPage('questions', page)}
              activeArtifact={activeArtifact}
              headerExtra={
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { key: 'all', label: 'All', activeClass: 'bg-zinc-700 text-white' },
                    { key: 'mistakes', label: `Mistakes${failedQuestionIds.size > 0 ? ` (${failedQuestionIds.size})` : ''}`, activeClass: 'bg-red-500 text-white' },
                  ] as const).map(({ key, label, activeClass }) => (
                    <button
                      key={key}
                      onClick={() => setQuestionFilter(key)}
                      className={cn(
                        'rounded-full px-3 py-0.5 text-xs font-semibold capitalize transition-colors',
                        questionFilter === key
                          ? activeClass
                          : 'border border-[var(--border-color)] bg-[var(--bg-app)] text-text-muted hover:text-text-main',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              {filteredQuestions.length === 0
                ? (questionFilter === 'mistakes'
                  ? <p className="text-sm text-text-muted">No mistakes yet — keep quizzing!</p>
                  : emptyLine)
                : pagedQuestions.items.map(question => (
                  <button key={question.quizId} onClick={() => setDetail(buildQuestionDetail(question))} className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5">
                    <p className="line-clamp-2 text-sm font-semibold text-text-main">{question.question}</p>
                    <p className="mt-1 text-xs text-text-muted">{question.difficulty} · {question.options.length} options</p>
                  </button>
                ))
              }
            </ArtifactSection>

            {/* Glossary */}
            <ArtifactSection
              id="glossary"
              icon={STUDY_TYPE_ICONS.glossary.icon}
              color={STUDY_TYPE_ICONS.glossary.color}
              title="Glossary Terms"
              count={filteredGlossary.length}
              page={pagedGlossary.page}
              totalPages={pagedGlossary.totalPages}
              onPageChange={page => setSectionPage('glossary', page)}
              activeArtifact={activeArtifact}
              headerExtra={
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { key: 'all', label: 'All', activeClass: 'bg-zinc-700 text-white' },
                    { key: 'unmastered', label: `Unmastered${glossaryFilter === 'all' && artifactBuckets.glossary.length > 0 ? ` (${artifactBuckets.glossary.filter(t => !masteredIds.has(t.id)).length})` : ''}`, activeClass: 'bg-amber-500 text-white' },
                  ] as const).map(({ key, label, activeClass }) => (
                    <button
                      key={key}
                      onClick={() => setGlossaryFilter(key)}
                      className={cn(
                        'rounded-full px-3 py-0.5 text-xs font-semibold transition-colors',
                        glossaryFilter === key
                          ? activeClass
                          : 'border border-[var(--border-color)] bg-[var(--bg-app)] text-text-muted hover:text-text-main',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              {filteredGlossary.length === 0
                ? (glossaryFilter === 'unmastered'
                  ? <p className="text-sm text-text-muted">All terms mastered — great work!</p>
                  : emptyLine)
                : pagedGlossary.items.map(term => (
                  <button key={term.id} onClick={() => setDetail(buildGlossaryDetail(term))} className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5">
                    <p className="text-sm font-semibold text-text-main">{term.term}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted">{term.definition}</p>
                  </button>
                ))
              }
            </ArtifactSection>

            {/* Worked Problems */}
            <ArtifactSection
              id="workedProblems"
              icon={STUDY_TYPE_ICONS.problems.icon}
              color={STUDY_TYPE_ICONS.problems.color}
              title="Worked Problems"
              count={filteredWorkedProblems.length}
              page={pagedWorkedProblems.page}
              totalPages={pagedWorkedProblems.totalPages}
              onPageChange={page => setSectionPage('workedProblems', page)}
              activeArtifact={activeArtifact}
              headerExtra={
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { key: 'all', label: 'All', activeClass: 'bg-zinc-700 text-white' },
                    { key: 'unmastered', label: `Unmastered${workedProblemFilter === 'all' && artifactBuckets.workedProblems.length > 0 ? ` (${artifactBuckets.workedProblems.filter(p => !masteredProblemIds.has(p.workedProblemId)).length})` : ''}`, activeClass: 'bg-amber-500 text-white' },
                  ] as const).map(({ key, label, activeClass }) => (
                    <button
                      key={key}
                      onClick={() => setWorkedProblemFilter(key)}
                      className={cn(
                        'rounded-full px-3 py-0.5 text-xs font-semibold transition-colors',
                        workedProblemFilter === key
                          ? activeClass
                          : 'border border-[var(--border-color)] bg-[var(--bg-app)] text-text-muted hover:text-text-main',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              {filteredWorkedProblems.length === 0
                ? (workedProblemFilter === 'unmastered'
                  ? <p className="text-sm text-text-muted">All problems mastered — great work!</p>
                  : emptyLine)
                : pagedWorkedProblems.items.map(problem => (
                  <button key={problem.workedProblemId} onClick={() => setDetail(buildProblemDetail(problem))} className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5">
                    <p className="line-clamp-2 text-sm font-semibold text-text-main">{problem.problemText}</p>
                    <p className="mt-1 text-xs text-text-muted">{problem.difficulty} · {problem.steps.length} steps</p>
                  </button>
                ))
              }
            </ArtifactSection>

            {/* Summaries */}
            <ArtifactSection id="summaries" icon={STUDY_TYPE_ICONS.summary.icon} color={STUDY_TYPE_ICONS.summary.color} title="Summaries" count={summaryRows.length} page={pagedSummaries.page} totalPages={pagedSummaries.totalPages} onPageChange={page => setSectionPage('summaries', page)} activeArtifact={activeArtifact}>
              {summaryRows.length === 0 ? emptyLine : pagedSummaries.items.map(row => (
                <button key={row.key} onClick={() => setDetail(buildSummaryDetail(row))} className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5">
                  <p className="truncate text-sm font-semibold text-text-main">{row.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">{row.summary}</p>
                </button>
              ))}
            </ArtifactSection>

            {/* Mind Maps */}
            {mindmapRows.length > 0 && (
              <ArtifactSection id="mindmaps" icon={STUDY_TYPE_ICONS.mindmap.icon} color={STUDY_TYPE_ICONS.mindmap.color} title="Mind Maps" count={mindmapRows.length} page={pagedMindmaps.page} totalPages={pagedMindmaps.totalPages} onPageChange={page => setSectionPage('mindmaps', page)} activeArtifact={activeArtifact}>
                {pagedMindmaps.items.map(row => (
                  <button key={row.key} onClick={() => setDetail(buildMindmapDetail(row))} className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5">
                    <p className="truncate text-sm font-semibold text-text-main">{row.title}</p>
                    <p className="mt-1 text-xs text-text-muted">{row.sourceKind === 'doc' ? 'Document' : 'Video'} · click to view</p>
                  </button>
                ))}
              </ArtifactSection>
            )}

            {/* AI Chats */}
            {chatRows.length > 0 && (
              <ArtifactSection id="chats" icon={STUDY_TYPE_ICONS.chat.icon} color={STUDY_TYPE_ICONS.chat.color} title="AI Chats" count={chatRows.length} page={pagedChats.page} totalPages={pagedChats.totalPages} onPageChange={page => setSectionPage('chats', page)} activeArtifact={activeArtifact}>
                {pagedChats.items.map(row => {
                  const session = chatSessions.get(row.documentId ?? row.videoId ?? '');
                  return (
                    <button key={row.key} onClick={() => setDetail(buildChatDetail(row))} className="w-full rounded-xl bg-[var(--bg-app)] p-3 text-left hover:bg-primary/5">
                      <p className="truncate text-sm font-semibold text-text-main">{row.title}</p>
                      {session?.lastMessage && (
                        <p className="mt-1 line-clamp-1 text-xs text-text-muted">{session.lastMessage}</p>
                      )}
                    </button>
                  );
                })}
              </ArtifactSection>
            )}

          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {detail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className={cn(
            'flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl',
            isMindmapOrChat
              ? 'w-full max-w-4xl h-[88vh]'
              : 'w-full max-w-2xl max-h-[86vh]',
          )}>

            {/* Modal header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-color)] bg-white p-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">{detail.type}</p>
                <h2 className="mt-1 text-lg font-bold text-text-main truncate">{detail.title}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className={cn('min-h-0 flex-1 overflow-hidden', !isMindmapOrChat && 'overflow-y-auto p-5 space-y-4 text-sm text-text-main')}>

              {/* Standard artifact types */}
              {detail.type === 'summary' && <div className="p-5"><ArtifactContent value={detail.content} /></div>}
              {detail.type === 'note' && <div className="p-5"><ArtifactContent value={detail.content} /></div>}
              {detail.type === 'flashcard' && (
                <div className="p-5 space-y-4">
                  <div className="rounded-xl bg-[var(--bg-app)] p-4">
                    <p className="text-xs font-bold text-text-muted">Front</p>
                    <ArtifactContent value={detail.front} className="mt-2" />
                  </div>
                  <div className="rounded-xl bg-primary/5 p-4">
                    <p className="text-xs font-bold text-primary">Back</p>
                    <ArtifactContent value={detail.back} className="mt-2" />
                  </div>
                </div>
              )}
              {detail.type === 'question' && (
                <div className="p-5 space-y-4 text-sm text-text-main">
                  <ArtifactContent value={detail.question.question} />

                  {revealAnswers ? (
                    /* ── Reveal mode: highlight correct / wrong options ── */
                    <>
                      <div className="space-y-2">
                        {detail.question.options.map((option, index) => {
                          const isCorrect = isQuizOptionCorrect(option, detail.question.correctAnswer);
                          const isWrongPick = !!detail.userAnswer
                            && isQuizOptionCorrect(option, detail.userAnswer)
                            && !isCorrect;
                          return (
                            <div
                              key={index}
                              className={cn(
                                'flex items-start gap-2.5 rounded-xl px-3 py-2.5',
                                isCorrect
                                  ? 'border border-emerald-300 bg-emerald-50'
                                  : isWrongPick
                                    ? 'border border-red-300 bg-red-50'
                                    : 'bg-[var(--bg-app)]',
                              )}
                            >
                              {isCorrect && (
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                              )}
                              {isWrongPick && (
                                <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                              )}
                              {!isCorrect && !isWrongPick && (
                                <span className="mt-0.5 h-4 w-4 shrink-0" />
                              )}
                              <ArtifactContent value={option} />
                            </div>
                          );
                        })}
                      </div>
                      {detail.question.explanation && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-amber-600">Analysis</p>
                          <ArtifactContent value={detail.question.explanation} className="text-amber-900" />
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── Standard mode: plain options only ── */
                    <div className="space-y-2">
                      {detail.question.options.map((option, index) => (
                        <div key={index} className="rounded-xl bg-[var(--bg-app)] px-3 py-2">
                          <ArtifactContent value={option} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {detail.type === 'glossary' && (
                <div className="p-5 text-sm text-text-main">
                  <p className="text-xl font-bold">{detail.term.term}</p>
                  <ArtifactContent value={detail.term.definition} className="mt-2 text-text-muted" />
                </div>
              )}
              {detail.type === 'problem' && (
                <div className="p-5 space-y-4 text-sm text-text-main">
                  <ArtifactContent value={detail.problem.problemText} />
                  <div className="space-y-2">
                    {detail.problem.steps.map(step => (
                      <div key={step.stepNumber} className="rounded-xl bg-[var(--bg-app)] p-3">
                        <p className="font-semibold">Step {step.stepNumber}</p>
                        <ArtifactContent value={step.description} className="mt-1 text-text-muted" />
                        {step.formula && <ArtifactContent value={`$$${step.formula}$$`} className="mt-2 text-primary" />}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-bold text-primary">Final answer</p>
                    <ArtifactContent value={detail.problem.finalAnswer} className="mt-1" />
                  </div>
                </div>
              )}

              {/* Mind Map */}
              {detail.type === 'mindmap' && (
                <div className="h-full p-4">
                  <MindMapViewer
                    mindMapText={mmText}
                    onGenerate={handleGenerateMindMap}
                    isGenerating={mmGenerating}
                    streamingText={mmStreaming}
                    title={detail.title}
                    externalError={mmError}
                  />
                </div>
              )}

              {/* AI Chat */}
              {detail.type === 'chat' && (
                chatLoading ? (
                  <div className="flex items-center justify-center h-full gap-2 text-text-muted">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm">Loading conversation…</span>
                  </div>
                ) : (
                  <ChatPanel
                    key={detail.itemKey}
                    externalMessages={chatMessages}
                    onExternalStreamSend={handleChatStreamSend}
                    placeholder={`Ask about "${detail.title}"…`}
                    hideHeader
                    hideAddToNotes
                  />
                )
              )}
            </div>

            {/* Modal footer — nav for standard artifacts only */}
            {!isMindmapOrChat && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-color)] bg-white p-4">
                <button
                  type="button"
                  onClick={() => switchDetail(-1)}
                  disabled={detailCount <= 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                {detail?.type === 'glossary' ? (
                  <button
                    type="button"
                    onClick={() => handleToggleMastered(detail.term.id)}
                    disabled={togglingGlossaryId === detail.term.id}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      masteredIds.has(detail.term.id)
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'border-[var(--border-color)] text-text-muted hover:border-emerald-400 hover:text-emerald-600',
                    )}
                  >
                    <CheckCircle2 size={15} />
                    {masteredIds.has(detail.term.id) ? 'Mastered' : 'Mark as mastered'}
                  </button>
                ) : detail?.type === 'problem' ? (
                  <button
                    type="button"
                    onClick={() => handleToggleProblemMastered(detail.problem.workedProblemId)}
                    disabled={togglingProblemId === detail.problem.workedProblemId}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      masteredProblemIds.has(detail.problem.workedProblemId)
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'border-[var(--border-color)] text-text-muted hover:border-emerald-400 hover:text-emerald-600',
                    )}
                  >
                    <CheckCircle2 size={15} />
                    {masteredProblemIds.has(detail.problem.workedProblemId) ? 'Mastered' : 'Mark as mastered'}
                  </button>
                ) : detail?.type === 'question' ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setRevealAnswers(prev => !prev)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors',
                        revealAnswers
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-[var(--border-color)] text-text-muted hover:border-primary hover:text-primary',
                      )}
                      title={revealAnswers ? 'Hide answer' : 'Reveal answer'}
                    >
                      <Eye size={15} />
                      {revealAnswers ? 'Hide' : 'Reveal'}
                    </button>
                    <span className="text-xs font-bold text-text-muted">{detailPosition} of {detailCount}</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-text-muted">{detailPosition} of {detailCount}</span>
                )}
                <button
                  type="button"
                  onClick={() => switchDetail(1)}
                  disabled={detailCount <= 1}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
