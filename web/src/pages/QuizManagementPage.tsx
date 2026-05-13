import React, { useState, useMemo, useEffect } from 'react';
import { useStudy } from '../context/StudyContext';
import {
  Sparkles, Award, Eye, EyeOff, Loader2, Download, Check, Edit3, FileText,
  Filter, Plus, Search, Trash2, X, XCircle, RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getDocDisplayName } from '../utils/docName';
import { SourceFilterBar, SourceType } from '../components/common/SourceFilterBar';
import { PendingItemsGrid, PendingItem } from '../components/common/PendingItemsGrid';
import { youtubeService, VideoListItem } from '../services/youtubeService';
import { ShareableQuiz } from '../services/shareContentService';
import { ShareModal } from '../components/common/ShareModal';
import { documentService, quizSubmissionService, QuizSubmission } from '../services/documentService';
import { TimedExamModal } from '../components/quiz/TimedExamModal';
import { QuizItemRow, QuizItemType } from '../components/quiz/QuizItemRow';
import { QuizQuestion, Document } from '../types';
import { PendingMaterial, pendingMaterialToItem } from '../services/pendingMaterialService';
import { Pagination } from '../components/common/Pagination';
import { useRefreshOnVisible } from '../hooks/useRefreshOnVisible';
import { usePrompt } from '../components/common/PromptBox';
import { getCorrectQuizOptionText, isQuizOptionCorrect } from '../utils/quizAnswers';
import {
  downloadMoodleGift,
  downloadQtiZip,
  downloadQuizCsv,
  ExportQuizRecord,
} from '../services/exportInteropService';
import {
  questionBankService,
  QuestionBankQuestion,
  QuestionDifficulty,
} from '../services/questionBankService';
import { cn } from '../utils/cn';

const PAGE_SIZE = 5;
const difficultyOptions: Array<'all' | QuestionDifficulty> = ['all', 'easy', 'medium', 'hard'];
const difficultyLabels: Record<QuestionDifficulty, string> = {
  easy: 'Beginner',
  medium: 'Intermediate',
  hard: 'Advanced',
};

const getDifficultyLabel = (difficulty: QuestionDifficulty | undefined): string =>
  difficulty ? difficultyLabels[difficulty] : difficultyLabels.medium;

type MainTab = 'history' | 'failed' | 'bank';

function docToQuizType(doc: Document | undefined): Exclude<QuizItemType, 'video'> {
  if (doc?.type === 'podcast') return 'podcast';
  if (doc?.type === 'audio') return 'audio';
  if (doc?.originalUrl) return 'article';
  return 'doc';
}

type DocQuizItem = {
  type: Exclude<QuizItemType, 'video'>;
  id: string;
  name: string;
  score?: number;
  total?: number;
  date?: string;
  courseId?: string;
  courseColor?: string;
  courseName?: string;
  docId?: string;
  pending?: boolean;
};

type VideoQuizItem = {
  type: 'video';
  id: string;
  name: string;
  courseId: string;
  courseColor: string;
  courseName: string;
  score?: number;
  total?: number;
  date?: string;
  pending?: boolean;
};

type UnifiedQuizItem = DocQuizItem | VideoQuizItem;

type FailedQuestion = {
  question: QuestionBankQuestion;
  submission: QuizSubmission;
  selectedAnswer: string;
  correctAnswer: string;
  sourceName: string;
  courseName?: string;
  courseColor?: string;
  submittedAt: string;
};

const toQuizQuestion = (q: QuestionBankQuestion): QuizQuestion => ({
  id: q.quizId,
  question: q.question,
  options: q.options,
  answer: q.correctAnswer,
  explanation: q.explanation,
  type: 'multiple-choice',
  difficulty: q.difficulty,
});

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const QuizManagementPage: React.FC = () => {
  const { documents, courses, quizSubmissions, totalMaterials, totalQuizSubmissions, achievementStats, isLoading: contextLoading, refreshQuizSubmissions, refreshStats, refreshDocuments } = useStudy();
  const navigate = useNavigate();
  const { showPrompt } = usePrompt();

  // ── Main tab ──────────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('history');

  // ── History tab state ─────────────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [videoList, setVideoList] = useState<VideoListItem[]>([]);
  const [shareTarget, setShareTarget] = useState<{
    title: string;
    fetchQuizzes: () => Promise<ShareableQuiz[]>;
    sourceType?: 'youtube' | 'article' | 'audio' | 'podcast' | 'document';
    sourceUrl?: string | null;
    originalArticleUrl?: string | null;
  } | null>(null);
  const [timedExamDocId, setTimedExamDocId] = useState<string | null>(null);
  const [timedExamDocName, setTimedExamDocName] = useState('');
  const [timedExamQuestions, setTimedExamQuestions] = useState<QuizQuestion[]>([]);
  const [loadingTimedExam, setLoadingTimedExam] = useState<string | null>(null);
  const [generatedPending, setGeneratedPending] = useState<UnifiedQuizItem[]>([]);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [coverage, setCoverage] = useState({ documentIds: [] as string[], youTubeVideoIds: [] as string[] });
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [exporting, setExporting] = useState<null | 'csv' | 'gift' | 'qti'>(null);

  // ── Failed tab state ─────────────────────────────────────────────────────────
  const [allQuizSubmissions, setAllQuizSubmissions] = useState<QuizSubmission[]>(quizSubmissions);
  const [failedBankQuestions, setFailedBankQuestions] = useState<QuestionBankQuestion[]>([]);
  const [failedLoading, setFailedLoading] = useState(false);
  const [failedSearch, setFailedSearch] = useState('');
  const [failedCourseId, setFailedCourseId] = useState('all');
  const [failedExamQuestions, setFailedExamQuestions] = useState<QuizQuestion[]>([]);

  // ── Question Bank tab state ───────────────────────────────────────────────────
  const [bankQuestions, setBankQuestions] = useState<QuestionBankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankCourseId, setBankCourseId] = useState('all');
  const [bankDifficulty, setBankDifficulty] = useState<'all' | QuestionDifficulty>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<QuestionBankQuestion | null>(null);
  const [bankExamQuestions, setBankExamQuestions] = useState<QuizQuestion[]>([]);
  const [bankExamTitle, setBankExamTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [bankExporting, setBankExporting] = useState<null | 'csv' | 'gift' | 'qti'>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());

  // ── History: remove pending entries once a real submission arrives ────────────
  useEffect(() => {
    const submittedDocIds = new Set(quizSubmissions.map(s => s.documentId).filter(Boolean));
    const submittedVideoIds = new Set(quizSubmissions.map(s => s.youTubeVideoId).filter(Boolean));
    setGeneratedPending(prev => prev.filter(p => p.type === 'video' ? !submittedVideoIds.has(p.id) : p.docId && !submittedDocIds.has(p.docId)));
  }, [quizSubmissions]);

  useEffect(() => {
    if (quizSubmissions.length) setAllQuizSubmissions(quizSubmissions);
  }, [quizSubmissions]);

  const refreshVideos = React.useCallback(() => {
    return youtubeService.getVideos({ page: 1, pageSize: 10 })
      .then(data => setVideoList(data.items))
      .catch(() => { });
  }, []);

  useEffect(() => {
    void refreshQuizSubmissions();
    void refreshStats();
    void refreshDocuments();
    void refreshVideos();
  }, [refreshQuizSubmissions, refreshStats, refreshDocuments, refreshVideos]);

  const generatedMaterialToQuizItem = React.useCallback((material: PendingMaterial): UnifiedQuizItem => {
    if (material.kind === 'video') {
      return {
        type: 'video',
        id: material.id,
        name: material.name,
        courseId: material.courseId,
        courseColor: material.courseColor,
        courseName: material.courseName,
        pending: true,
      };
    }
    const doc = pendingMaterialToItem(material).doc;
    return {
      type: docToQuizType(doc),
      id: `generated-${material.id}`,
      name: getDocDisplayName(doc),
      courseId: material.courseId,
      courseColor: material.courseColor,
      courseName: material.courseName,
      docId: material.id,
      pending: true,
    };
  }, []);

  const refreshGeneratedMaterials = React.useCallback(() => {
    return quizSubmissionService.getGeneratedMaterials()
      .then(items => setGeneratedPending(items.map(generatedMaterialToQuizItem)))
      .catch(() => setGeneratedPending([]));
  }, [generatedMaterialToQuizItem]);

  useEffect(() => { void refreshGeneratedMaterials(); }, [refreshGeneratedMaterials]);

  const refreshCoverage = React.useCallback(() => {
    setCoverageLoading(true);
    return quizSubmissionService.getCoverage()
      .then(setCoverage)
      .catch(() => setCoverage({ documentIds: [], youTubeVideoIds: [] }))
      .finally(() => setCoverageLoading(false));
  }, []);

  useEffect(() => { void refreshCoverage(); }, [refreshCoverage]);

  const refreshPendingItems = React.useCallback(() => {
    setPendingLoading(true);
    return quizSubmissionService.getPendingMaterials()
      .then(items => setPendingItems(items.map(pendingMaterialToItem)))
      .catch(() => setPendingItems([]))
      .finally(() => setPendingLoading(false));
  }, []);

  useEffect(() => { void refreshPendingItems(); }, [refreshPendingItems]);

  const loadAllQuizSubmissions = React.useCallback(async () => {
    const firstPage = await quizSubmissionService.getAllSubmissions(1, 100);
    if (firstPage.totalCount > firstPage.items.length) {
      const fullPage = await quizSubmissionService.getAllSubmissions(1, firstPage.totalCount);
      setAllQuizSubmissions(fullPage.items);
      return fullPage.items;
    }
    setAllQuizSubmissions(firstPage.items);
    return firstPage.items;
  }, []);

  const loadFailedQuizData = React.useCallback(async () => {
    setFailedLoading(true);
    try {
      const [questions] = await Promise.all([
        questionBankService.getQuestions(),
        loadAllQuizSubmissions(),
      ]);
      setFailedBankQuestions(questions);
    } finally {
      setFailedLoading(false);
    }
  }, [loadAllQuizSubmissions]);

  useEffect(() => {
    if (mainTab === 'failed') void loadFailedQuizData();
  }, [mainTab, loadFailedQuizData]);

  useRefreshOnVisible(React.useCallback(async () => {
    await Promise.all([
      refreshQuizSubmissions(),
      refreshStats(),
      refreshDocuments(),
      refreshGeneratedMaterials(),
      refreshCoverage(),
      refreshPendingItems(),
      refreshVideos(),
    ]);
    if (mainTab === 'failed') await loadFailedQuizData();
  }, [
    refreshQuizSubmissions,
    refreshStats,
    refreshDocuments,
    refreshGeneratedMaterials,
    refreshCoverage,
    refreshPendingItems,
    refreshVideos,
    mainTab,
    loadFailedQuizData,
  ]));

  // ── Question Bank: load when tab opens ────────────────────────────────────────
  const loadBankQuestions = React.useCallback(async () => {
    setBankLoading(true);
    try {
      const items = await questionBankService.getQuestions({
        courseId: bankCourseId === 'all' ? undefined : bankCourseId,
        difficulty: bankDifficulty === 'all' ? undefined : bankDifficulty,
      });
      setBankQuestions(items);
    } finally {
      setBankLoading(false);
    }
  }, [bankCourseId, bankDifficulty]);

  useEffect(() => {
    if (mainTab === 'bank') void loadBankQuestions();
  }, [mainTab, loadBankQuestions]);

  // ── History handlers ──────────────────────────────────────────────────────────

  const handleStartTimedExam = async (docId: string, docName: string) => {
    setLoadingTimedExam(docId);
    try {
      const doc = documents.find(d => d.id === docId);
      const questions = await documentService.getQuiz(doc?.courseId || '', docId);
      if (questions.length === 0) { showPrompt('No questions available for this document.'); return; }
      setTimedExamQuestions(questions);
      setTimedExamDocName(docName);
      setTimedExamDocId(docId);
    } catch {
      showPrompt('Failed to load questions. Please try again.');
    } finally {
      setLoadingTimedExam(null);
    }
  };

  const handleStartVideoTimedExam = async (videoId: string, videoName: string) => {
    setLoadingTimedExam(videoId);
    try {
      const questions = await youtubeService.getQuiz(videoId);
      if (questions.length === 0) { showPrompt('No questions available for this video.'); return; }
      setTimedExamQuestions(questions.map(q => ({
        id: q.quizId, question: q.question, options: q.options,
        answer: q.correctAnswer, explanation: q.explanation, type: 'multiple-choice' as const,
      })));
      setTimedExamDocName(videoName);
      setTimedExamDocId(videoId);
    } catch {
      showPrompt('Failed to load questions. Please try again.');
    } finally {
      setLoadingTimedExam(null);
    }
  };

  const handleShareQuiz = (docId: string, docName: string, courseId: string) => {
    const doc = documents.find(d => d.id === docId);
    const isArticle = !!doc?.originalUrl;
    const isAudio = doc?.type === 'audio';
    const isPodcast = doc?.type === 'podcast';
    const srcType: 'article' | 'audio' | 'podcast' | 'document' =
      isArticle ? 'article' : isAudio ? 'audio' : isPodcast ? 'podcast' : 'document';
    setShareTarget({
      title: docName,
      fetchQuizzes: async () => {
        const questions = await documentService.getQuiz(courseId, docId);
        return questions.map(q => ({
          question: q.question, options: q.options ?? [],
          correctAnswer: q.answer, explanation: q.explanation ?? '',
        }));
      },
      sourceType: srcType,
      sourceUrl: courseId ? `${courseId}/${docId}` : null,
      originalArticleUrl: isArticle ? (doc?.originalUrl ?? null) : null,
    });
  };

  const resolveVideoUrl = React.useCallback(async (videoId: string): Promise<string | null> => {
    const cachedVideo = videoList.find(v => v.id === videoId);
    if (cachedVideo?.videoUrl) return cachedVideo.videoUrl;
    try {
      const video = await youtubeService.getVideo(videoId);
      return video.videoUrl ?? null;
    } catch {
      return null;
    }
  }, [videoList]);

  const handleShareVideoQuiz = async (videoId: string, videoName: string) => {
    const video = videoList.find(v => v.id === videoId);
    const sourceUrl = video?.videoUrl ?? await resolveVideoUrl(videoId);
    setShareTarget({
      title: videoName,
      fetchQuizzes: async () => {
        const questions = await youtubeService.getQuiz(videoId);
        return questions.map(q => ({
          question: q.question, options: q.options ?? [],
          correctAnswer: q.correctAnswer, explanation: q.explanation ?? '',
        }));
      },
      sourceType: 'youtube',
      sourceUrl,
    });
  };

  const loadQuizRecordsForExport = async (): Promise<ExportQuizRecord[]> => {
    const records: ExportQuizRecord[] = [];
    for (const item of filteredItems.filter(i => !i.pending)) {
      try {
        if (item.type === 'video') {
          const questions = await youtubeService.getQuiz(item.id);
          if (questions.length) {
            records.push({
              title: item.name,
              courseName: item.courseName,
              questions: questions.map(q => ({
                question: q.question,
                options: q.options ?? [],
                correctAnswer: getCorrectQuizOptionText(q.options, q.correctAnswer),
                explanation: q.explanation ?? '',
              })),
            });
          }
        } else if (item.docId) {
          const questions = await documentService.getQuiz(item.courseId ?? '', item.docId);
          if (questions.length) {
            records.push({
              title: item.name,
              courseName: item.courseName,
              questions: questions.map(q => ({
                question: q.question,
                options: q.options ?? [],
                correctAnswer: getCorrectQuizOptionText(q.options, q.answer),
                explanation: q.explanation ?? '',
              })),
            });
          }
        }
      } catch {
        // skip unloadable sources
      }
    }
    return records;
  };

  const handleExportQuizzes = async (format: 'csv' | 'gift' | 'qti') => {
    setExporting(format);
    try {
      const records = await loadQuizRecordsForExport();
      if (records.length === 0) {
        showPrompt('No exportable quiz questions found for the current filters.');
        return;
      }
      if (format === 'csv') downloadQuizCsv(records, 'filtered_quizzes');
      else if (format === 'gift') downloadMoodleGift(records, 'filtered_quizzes');
      else await downloadQtiZip(records, 'filtered_quizzes');
    } finally {
      setExporting(null);
    }
  };

  // ── Question Bank handlers ────────────────────────────────────────────────────

  const bankFiltered = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return bankQuestions;
    return bankQuestions.filter(item =>
      [item.question, item.explanation, item.sourceName, item.courseName, getDifficultyLabel(item.difficulty), item.difficulty, ...item.options]
        .some(value => value?.toLowerCase().includes(q)),
    );
  }, [bankQuestions, bankSearch]);

  const selectedQuestions = useMemo(() =>
    bankFiltered.filter(q => selectedIds.has(q.quizId)),
    [bankFiltered, selectedIds],
  );

  const bankExportRecords = (items: QuestionBankQuestion[]): ExportQuizRecord[] => [{
    title: 'Question Bank',
    questions: items.map(q => ({
      question: q.question,
      options: q.options,
      correctAnswer: getCorrectQuizOptionText(q.options, q.correctAnswer),
      explanation: q.explanation,
    })),
  }];

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartBankExam = (mode: 'selected' | 'filtered') => {
    const pool = mode === 'selected' && selectedQuestions.length > 0 ? selectedQuestions : bankFiltered;
    const questionsForExam = shuffle(pool).slice(0, Math.min(50, pool.length)).map(toQuizQuestion);
    setBankExamQuestions(questionsForExam);
    setBankExamTitle(mode === 'selected' ? 'Selected Questions' : 'Filtered Question Bank');
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await questionBankService.updateQuestion(editing.quizId, {
        question: editing.question,
        options: editing.options,
        correctAnswer: editing.correctAnswer,
        explanation: editing.explanation,
        difficulty: editing.difficulty,
      });
      setBankQuestions(prev => prev.map(q => q.quizId === updated.quizId ? updated : q));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBankQuestion = async (question: QuestionBankQuestion) => {
    await questionBankService.deleteQuestion(question.quizId);
    setBankQuestions(prev => prev.filter(q => q.quizId !== question.quizId));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(question.quizId);
      return next;
    });
  };

  const handleBankExport = async (format: 'csv' | 'gift' | 'qti') => {
    const items = selectedQuestions.length > 0 ? selectedQuestions : bankFiltered;
    setBankExporting(format);
    try {
      const records = bankExportRecords(items);
      if (format === 'csv') downloadQuizCsv(records, 'question_bank');
      else if (format === 'gift') downloadMoodleGift(records, 'question_bank');
      else await downloadQtiZip(records, 'question_bank');
    } finally {
      setBankExporting(null);
    }
  };

  const toggleAnswer = (id: string) => {
    setRevealedAnswers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Failed quiz handlers ─────────────────────────────────────────────────────

  const failedQuestions = useMemo<FailedQuestion[]>(() => {
    const byId = new Map(failedBankQuestions.map(question => [question.quizId, question]));

    return allQuizSubmissions.flatMap(submission => {
      const sourceQuestions = failedBankQuestions.filter(question => {
        if (submission.youTubeVideoId || submission.sourceType === 'video') {
          return question.sourceType === 'video' && question.youTubeVideoId === submission.youTubeVideoId;
        }
        return question.sourceType === 'document' && question.documentId === submission.documentId;
      });
      const questionsToCheck = sourceQuestions.length > 0
        ? sourceQuestions
        : Object.keys(submission.answers ?? {})
          .map(id => byId.get(id))
          .filter((question): question is QuestionBankQuestion => !!question);

      return questionsToCheck.flatMap(question => {
        const selectedAnswer = submission.answers?.[question.quizId] ?? '';
        if (selectedAnswer && isQuizOptionCorrect(selectedAnswer, question.correctAnswer)) return [];

        return [{
          question,
          submission,
          selectedAnswer,
          correctAnswer: getCorrectQuizOptionText(question.options, question.correctAnswer),
          sourceName: question.sourceName ?? submission.documentName ?? submission.videoName ?? 'Unknown source',
          courseName: question.courseName,
          courseColor: question.courseColor,
          submittedAt: submission.submittedAt,
        }];
      });
    }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [allQuizSubmissions, failedBankQuestions]);

  const failedFiltered = useMemo(() => {
    const query = failedSearch.trim().toLowerCase();
    return failedQuestions.filter(item => {
      if (failedCourseId !== 'all' && item.question.courseId !== failedCourseId) return false;
      if (!query) return true;
      return [
        item.question.question,
        item.question.explanation,
        item.sourceName,
        item.courseName,
        item.selectedAnswer,
        item.correctAnswer,
        getDifficultyLabel(item.question.difficulty),
        ...item.question.options,
      ].some(value => value?.toLowerCase().includes(query));
    });
  }, [failedQuestions, failedSearch, failedCourseId]);

  const handleStartFailedExam = () => {
    const unique = Array.from(
      new Map(failedFiltered.map(item => [item.question.quizId, item.question])).values(),
    );
    setFailedExamQuestions(shuffle(unique).slice(0, Math.min(50, unique.length)).map(toQuizQuestion));
  };

  // ── History data ──────────────────────────────────────────────────────────────

  const docQuizItems = useMemo<DocQuizItem[]>(() =>
    quizSubmissions.filter(s => !s.youTubeVideoId && s.sourceType !== 'video').map(s => {
      const doc = documents.find(d => d.id === s.documentId);
      const course = courses.find(c => c.id === doc?.courseId);
      return {
        type: docToQuizType(doc),
        id: s.submissionId,
        name: doc ? getDocDisplayName(doc) : (s.documentName ?? 'Unknown Document'),
        score: s.score,
        total: s.total,
        date: s.submittedAt,
        courseId: doc?.courseId,
        courseColor: course?.color,
        courseName: course?.name,
        docId: doc?.id,
      };
    }), [quizSubmissions, documents, courses]);

  const videoQuizItems = useMemo<VideoQuizItem[]>(() =>
    quizSubmissions.filter(s => s.youTubeVideoId || s.sourceType === 'video').map(s => ({
      type: 'video' as const,
      id: s.youTubeVideoId ?? s.submissionId,
      name: s.videoName ?? 'Unknown Video',
      courseId: '',
      courseColor: '#a1a1aa',
      courseName: '',
      score: s.score,
      total: s.total,
      date: s.submittedAt,
    })), [quizSubmissions]);

  const allItems = useMemo<UnifiedQuizItem[]>(() => {
    const submittedDocIds = new Set(docQuizItems.map(i => i.docId).filter(Boolean));
    const submittedVideoIds = new Set(videoQuizItems.map(i => i.id));
    const filteredPending = generatedPending.filter(p => p.type === 'video' ? !submittedVideoIds.has(p.id) : p.docId && !submittedDocIds.has(p.docId));
    return [...docQuizItems, ...filteredPending, ...videoQuizItems];
  }, [docQuizItems, videoQuizItems, generatedPending]);

  const counts = useMemo(() => ({
    all: allItems.length,
    document: allItems.filter(i => i.type === 'doc').length,
    video: allItems.filter(i => i.type === 'video').length,
    article: allItems.filter(i => i.type === 'article').length,
    audio: allItems.filter(i => i.type === 'audio' || i.type === 'podcast').length,
  }), [allItems]);

  const courseCounts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const item of allItems) {
      if (!item.courseId) continue;
      next[item.courseId] = (next[item.courseId] ?? 0) + 1;
    }
    return next;
  }, [allItems]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (sourceType === 'document') items = items.filter(i => i.type === 'doc');
    else if (sourceType === 'video') items = items.filter(i => i.type === 'video');
    else if (sourceType === 'article') items = items.filter(i => i.type === 'article');
    else if (sourceType === 'audio') items = items.filter(i => i.type === 'audio' || i.type === 'podcast');
    if (selectedCourseId) items = items.filter(i => i.courseId === selectedCourseId);
    return items;
  }, [allItems, sourceType, selectedCourseId]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleFilterChange = (cb: () => void) => { cb(); setPage(1); };

  const pendingItemsCount = Math.max(
    0,
    totalMaterials - coverage.documentIds.length - coverage.youTubeVideoIds.length - generatedPending.length,
  );

  const visiblePendingItems = useMemo(() => {
    const generatedDocIds = new Set(generatedPending.filter(p => p.type !== 'video').map(p => p.docId).filter(Boolean));
    const generatedVideoIds = new Set(generatedPending.filter(p => p.type === 'video').map(p => p.id));
    return pendingItems.filter(item => item.kind === 'video' ? !generatedVideoIds.has(item.video.id) : !generatedDocIds.has(item.doc.id));
  }, [generatedPending, pendingItems]);

  const docStats = {
    totalTaken: totalQuizSubmissions,
    avgScore: achievementStats.averageQuizScore,
    perfectScores: achievementStats.perfectQuizzes,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-text-main">
            Quiz <span className="text-primary">Center</span>
          </h1>
          <p className="text-base sm:text-lg text-zinc-500 font-medium max-w-2xl">
            Track your progress and sharpen your knowledge.
          </p>
        </div>
        {mainTab === 'history' && docStats.totalTaken > 0 && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)]/70 p-1">
              {(['csv', 'gift', 'qti'] as const).map(format => (
                <button
                  key={format}
                  onClick={() => handleExportQuizzes(format)}
                  disabled={!!exporting}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-text-main hover:bg-white disabled:opacity-50"
                >
                  {exporting === format ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-teal-400/30 bg-teal-50/50 px-4 py-2 text-center">
              <p className="text-xl font-bold text-teal-600">{docStats.avgScore}%</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-500/70">avg score</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-50/50 px-4 py-2 text-center">
              <p className="text-xl font-bold text-emerald-600">{docStats.perfectScores}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">perfect</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)]/70 px-4 py-2 text-center">
              <p className="text-xl font-bold text-text-main">{docStats.totalTaken}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">taken</p>
            </div>
          </div>
        )}
        {mainTab === 'bank' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleStartBankExam('selected')}
              disabled={selectedQuestions.length === 0 && bankFiltered.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              <Plus size={15} />
              Mock Exam
            </button>
            {(['csv', 'gift', 'qti'] as const).map(format => (
              <button
                key={format}
                onClick={() => handleBankExport(format)}
                disabled={!!bankExporting || bankFiltered.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-3 py-2 text-xs font-bold text-text-main hover:border-primary/40 disabled:opacity-40"
              >
                {bankExporting === format ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        {mainTab === 'failed' && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleStartFailedExam}
              disabled={failedFiltered.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              <RotateCcw size={15} />
              Retry Failed
            </button>
            <div className="rounded-2xl border border-red-400/30 bg-red-50/50 px-4 py-2 text-center">
              <p className="text-xl font-bold text-red-600">{failedFiltered.length}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500/70">wrong</p>
            </div>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 w-fit">
        <button
          onClick={() => setMainTab('history')}
          className={cn('rounded-lg px-4 py-2 text-sm font-bold transition-all', mainTab === 'history' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main')}
        >
          History
        </button>
        <button
          onClick={() => setMainTab('failed')}
          className={cn('rounded-lg px-4 py-2 text-sm font-bold transition-all', mainTab === 'failed' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main')}
        >
          Review Mistakes
        </button>
        <button
          onClick={() => setMainTab('bank')}
          className={cn('rounded-lg px-4 py-2 text-sm font-bold transition-all', mainTab === 'bank' ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main')}
        >
          Question Bank
        </button>
      </div>

      {/* ── History tab ── */}
      {mainTab === 'history' && (
        <>
          <SourceFilterBar
            courses={courses}
            selectedCourseId={selectedCourseId}
            onSelectCourse={id => handleFilterChange(() => setSelectedCourseId(id))}
            sourceType={sourceType}
            onSelectType={t => handleFilterChange(() => setSourceType(t))}
            counts={counts}
            courseCounts={courseCounts}
            hideTypeTabs={true}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-main">All Quizzes</h2>
              <span className="text-sm text-text-muted">{filteredItems.length} items</span>
            </div>

            {contextLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] py-12 text-center">
                <Award size={32} className="mb-4 text-zinc-300" />
                <h3 className="text-lg font-medium text-text-main">No quizzes found</h3>
                <p className="text-text-muted">Start a quiz from any document to see your results here.</p>
                {allItems.length === 0 && (
                  <button
                    onClick={() => navigate(documents.length > 0 ? '/library' : '/summarizer')}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                  >
                    {documents.length > 0 ? 'Go to Library' : 'Add Content'}
                  </button>
                )}
              </div>
            ) : (
              <>
                {pagedItems.map((item) => {
                  if (item.type === 'video') {
                    return (
                      <QuizItemRow
                        key={item.id}
                        type="video"
                        id={item.id}
                        name={item.name}
                        score={item.score}
                        total={item.total}
                        date={item.date}
                        courseName={item.courseName || undefined}
                        courseColor={item.courseColor || undefined}
                        pending={item.pending}
                        examKey={item.id}
                        loadingTimedExam={loadingTimedExam}
                        onShare={() => handleShareVideoQuiz(item.id, item.name)}
                        onExam={() => handleStartVideoTimedExam(item.id, item.name)}
                      />
                    );
                  }
                  const docId = item.docId;
                  return (
                    <QuizItemRow
                      key={item.id}
                      type={item.type}
                      id={item.id}
                      name={item.name}
                      score={item.score}
                      total={item.total}
                      date={item.date}
                      courseName={item.courseName}
                      courseColor={item.courseColor}
                      docId={docId}
                      pending={item.pending}
                      examKey={docId ?? item.id}
                      loadingTimedExam={loadingTimedExam}
                      onShare={docId ? () => handleShareQuiz(docId, item.name, item.courseId ?? '') : undefined}
                      onExam={docId ? () => handleStartTimedExam(docId, item.name) : undefined}
                    />
                  );
                })}
                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  size="sm"
                />
              </>
            )}
          </div>

          {!contextLoading && !coverageLoading && !pendingLoading && (
            <PendingItemsGrid
              items={visiblePendingItems}
              label="Not Yet Quizzed"
              activeTab="quiz"
              ctaText="Start"
              courses={courses}
              countOverride={pendingItemsCount}
              onGenerated={(item) => {
                if (item.kind === 'doc') {
                  const doc = item.doc;
                  const course = courses.find(c => c.id === doc.courseId);
                  setGeneratedPending(prev => [
                    ...prev.filter(p => p.type === 'video' || p.docId !== doc.id),
                    {
                      type: docToQuizType(doc),
                      id: `pending-${doc.id}`,
                      name: getDocDisplayName(doc),
                      courseId: doc.courseId,
                      courseColor: course?.color,
                      courseName: course?.name,
                      docId: doc.id,
                      pending: true,
                    },
                  ]);
                }
                refreshQuizSubmissions();
                void refreshStats();
                void refreshGeneratedMaterials();
                void refreshCoverage();
                void refreshPendingItems();
              }}
            />
          )}
        </>
      )}

      {/* ── Failed quiz tab ── */}
      {mainTab === 'failed' && (
        <>
          <div className="rounded-2xl border border-[var(--border-color)] bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={failedSearch}
                  onChange={e => setFailedSearch(e.target.value)}
                  placeholder="Search failed questions..."
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <select value={failedCourseId} onChange={e => setFailedCourseId(e.target.value)} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm">
                <option value="all">All courses</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-text-muted">
            <span className="inline-flex items-center gap-2"><XCircle size={14} /> {failedFiltered.length} failed questions</span>
            <button
              onClick={() => void loadFailedQuizData()}
              disabled={failedLoading}
              className="font-semibold text-primary hover:underline disabled:opacity-40"
            >
              Refresh
            </button>
          </div>

          {failedLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
          ) : failedFiltered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center">
              <Award size={34} className="mx-auto mb-3 text-zinc-300" />
              <h3 className="font-bold text-text-main">No failed questions found</h3>
              <p className="mt-1 text-sm text-text-muted">Wrong quiz answers will appear here after you submit quizzes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {failedFiltered.map(item => (
                <div key={`${item.submission.submissionId}-${item.question.quizId}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                  <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                      <XCircle size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">failed</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{getDifficultyLabel(item.question.difficulty)}</span>
                        {item.courseName && (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: item.courseColor ?? '#0d9488' }}>{item.courseName}</span>
                        )}
                        <span className="text-xs text-text-muted">{item.sourceName}</span>
                        <span className="text-xs text-text-muted">{new Date(item.submittedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-2 font-semibold leading-relaxed text-text-main">{item.question.question}</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {item.question.options.map((option, index) => {
                          const correct = isQuizOptionCorrect(option, item.question.correctAnswer);
                          const selected = item.selectedAnswer && isQuizOptionCorrect(option, item.selectedAnswer);
                          const revealed = revealedAnswers.has(item.question.quizId);
                          return (
                            <div
                              key={`${item.question.quizId}-${index}`}
                              className={cn(
                                'rounded-xl border px-3 py-2 text-sm',
                                revealed && correct ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : revealed && !!(selected && !correct) ? 'border-red-200 bg-red-50 text-red-700'
                                    : 'border-zinc-100 bg-zinc-50 text-text-main',
                              )}
                            >
                              {option}
                            </div>
                          );
                        })}
                      </div>
                      {item.question.explanation && <p className="mt-3 text-sm text-text-muted">{item.question.explanation}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button
                        onClick={() => toggleAnswer(item.question.quizId)}
                        className={cn('rounded-lg p-2', revealedAnswers.has(item.question.quizId) ? 'text-primary bg-primary/10' : 'text-text-muted hover:bg-primary/10 hover:text-primary')}
                        title={revealedAnswers.has(item.question.quizId) ? 'Hide answer' : 'Show answer'}
                      >
                        {revealedAnswers.has(item.question.quizId) ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Question Bank tab ── */}
      {mainTab === 'bank' && (
        <>
          <div className="rounded-2xl border border-[var(--border-color)] bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_140px]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={bankSearch}
                  onChange={e => setBankSearch(e.target.value)}
                  placeholder="Search questions, options, explanations..."
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <select value={bankCourseId} onChange={e => setBankCourseId(e.target.value)} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm">
                <option value="all">All courses</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
              <select value={bankDifficulty} onChange={e => setBankDifficulty(e.target.value as any)} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2 text-sm">
                {difficultyOptions.map(d => <option key={d} value={d}>{d === 'all' ? 'All levels' : getDifficultyLabel(d)}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-text-muted">
            <span className="inline-flex items-center gap-2"><Filter size={14} /> {bankFiltered.length} questions</span>
            <button
              onClick={() => setSelectedIds(new Set(bankFiltered.map(q => q.quizId)))}
              className="font-semibold text-primary hover:underline"
            >
              Select filtered
            </button>
          </div>

          {bankLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
          ) : bankFiltered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center">
              <FileText size={34} className="mx-auto mb-3 text-zinc-300" />
              <h3 className="font-bold text-text-main">No questions found</h3>
              <p className="mt-1 text-sm text-text-muted">Generate quizzes from documents or videos first, then manage them here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bankFiltered.map(question => {
                const selected = selectedIds.has(question.quizId);
                return (
                  <div key={question.quizId} className={cn('rounded-2xl border bg-white p-4 shadow-sm', selected ? 'border-primary/50' : 'border-[var(--border-color)]')}>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSelect(question.quizId)}
                        className={cn('mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border', selected ? 'border-primary bg-primary text-white' : 'border-zinc-300')}
                        title="Select question"
                      >
                        {selected && <Check size={13} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{getDifficultyLabel(question.difficulty)}</span>
                          {question.courseName && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: question.courseColor ?? '#0d9488' }}>{question.courseName}</span>
                          )}
                          <span className="text-xs text-text-muted">{question.sourceName ?? question.sourceType}</span>
                        </div>
                        <p className="mt-2 font-semibold leading-relaxed text-text-main">{question.question}</p>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {question.options.map((option, index) => {
                            const correct = getCorrectQuizOptionText(question.options, question.correctAnswer) === option;
                            const revealed = revealedAnswers.has(question.quizId);
                            return (
                              <div key={`${question.quizId}-${index}`} className={cn('rounded-xl border px-3 py-2 text-sm', revealed && correct ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-100 bg-zinc-50 text-text-main')}>
                                {option}
                              </div>
                            );
                          })}
                        </div>
                        {question.explanation && <p className="mt-3 text-sm text-text-muted">{question.explanation}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          onClick={() => toggleAnswer(question.quizId)}
                          className={cn('rounded-lg p-2', revealedAnswers.has(question.quizId) ? 'text-primary bg-primary/10' : 'text-text-muted hover:bg-primary/10 hover:text-primary')}
                          title={revealedAnswers.has(question.quizId) ? 'Hide answer' : 'Show answer'}
                        >
                          {revealedAnswers.has(question.quizId) ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <button onClick={() => setEditing(question)} className="rounded-lg p-2 text-text-muted hover:bg-primary/10 hover:text-primary" title="Edit question">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => handleDeleteBankQuestion(question)} className="rounded-lg p-2 text-text-muted hover:bg-red-50 hover:text-red-500" title="Delete question">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Edit question modal */}
      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-main">Edit Question</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-text-muted hover:bg-zinc-100"><X size={18} /></button>
            </div>
            <div className="mt-4 space-y-3">
              <textarea value={editing.question} onChange={e => setEditing({ ...editing, question: e.target.value })} className="min-h-24 w-full rounded-xl border border-[var(--border-color)] p-3 text-sm outline-none focus:border-primary" />
              {editing.options.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={e => setEditing({ ...editing, options: editing.options.map((o, i) => i === index ? e.target.value : o) })}
                  className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-primary"
                />
              ))}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  value={getCorrectQuizOptionText(editing.options, editing.correctAnswer)}
                  onChange={e => setEditing({ ...editing, correctAnswer: e.target.value })}
                  className="rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {editing.options.map((option, index) => (
                    <option key={`${index}-${option}`} value={option}>
                      {option || 'Blank option'}
                    </option>
                  ))}
                </select>
                <select value={editing.difficulty} onChange={e => setEditing({ ...editing, difficulty: e.target.value as QuestionDifficulty })} className="rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm">
                  <option value="easy">Beginner</option>
                  <option value="medium">Intermediate</option>
                  <option value="hard">Advanced</option>
                </select>
              </div>
              <textarea value={editing.explanation} onChange={e => setEditing({ ...editing, explanation: e.target.value })} placeholder="Explanation" className="min-h-20 w-full rounded-xl border border-[var(--border-color)] p-3 text-sm outline-none focus:border-primary" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(null)} className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-bold text-text-muted">Cancel</button>
                <button onClick={handleSaveEdit} disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timed exam modals */}
      <TimedExamModal
        isOpen={timedExamDocId !== null}
        onClose={() => setTimedExamDocId(null)}
        questions={timedExamQuestions}
        sourceTitle={timedExamDocName}
      />
      <TimedExamModal
        isOpen={bankExamQuestions.length > 0}
        onClose={() => setBankExamQuestions([])}
        questions={bankExamQuestions}
        sourceTitle={bankExamTitle}
        timeLimitMinutes={Math.max(5, Math.ceil(bankExamQuestions.length * 1.5))}
      />
      <TimedExamModal
        isOpen={failedExamQuestions.length > 0}
        onClose={() => setFailedExamQuestions([])}
        questions={failedExamQuestions}
        sourceTitle="Failed Questions"
        timeLimitMinutes={Math.max(5, Math.ceil(failedExamQuestions.length * 1.5))}
      />
      {shareTarget && (
        <ShareModal
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
          title={shareTarget.title}
          fetchQuizzes={shareTarget.fetchQuizzes}
          sourceType={shareTarget.sourceType}
          sourceUrl={shareTarget.sourceUrl}
          originalArticleUrl={shareTarget.originalArticleUrl}
        />
      )}
    </div>
  );
};
