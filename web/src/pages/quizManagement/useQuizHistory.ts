import React, { useState, useMemo, useEffect } from 'react';
import { useStudy } from '../../context/StudyContext';
import { getDocDisplayName } from '../../utils/docName';
import { SourceType } from '../../components/common/SourceFilterBar';
import { PendingItem } from '../../components/common/PendingItemsGrid';
import { videoService } from '../../services/videoService';
import { ShareableQuiz } from '../../services/shareContentService';
import { documentService, quizSubmissionService } from '../../services/documentService';
import { QuizQuestion } from '../../types';
import { PendingMaterial, pendingMaterialToItem } from '../../services/pendingMaterialService';
import { usePrompt } from '../../components/common/PromptBox';
import { getCorrectQuizOptionText } from '../../utils/quizAnswers';
import {
  downloadMoodleGift,
  downloadQtiZip,
  downloadQuizCsv,
  ExportQuizRecord,
} from '../../services/exportInteropService';
import { PAGE_SIZE, docToQuizType, DocQuizItem, VideoQuizItem, UnifiedQuizItem } from './types';

export type ShareTarget = {
  title: string;
  fetchQuizzes: () => Promise<ShareableQuiz[]>;
  sourceType?: 'youtube' | 'article' | 'audio' | 'podcast' | 'document';
  sourceUrl?: string | null;
  originalArticleUrl?: string | null;
} | null;

/**
 * Owns all state, data loading, derived collections and handlers for the History tab:
 * quiz submissions merged with generated/pending materials, source/course filtering,
 * pagination, timed-exam launches, sharing and interop export.
 */
export function useQuizHistory() {
  const {
    documents, courses, quizSubmissions, totalMaterials, totalQuizSubmissions,
    achievementStats, refreshQuizSubmissions, refreshStats, refreshDocuments,
    videos: videoList, refreshVideos,
  } = useStudy();
  const { showPrompt } = usePrompt();

  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [shareTarget, setShareTarget] = useState<ShareTarget>(null);
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

  // Remove pending entries once a real submission arrives.
  useEffect(() => {
    const submittedDocIds = new Set(quizSubmissions.map(s => s.documentId).filter(Boolean));
    const submittedVideoIds = new Set(quizSubmissions.map(s => s.youTubeVideoId).filter(Boolean));
    setGeneratedPending(prev => prev.filter(p => p.type === 'video' ? !submittedVideoIds.has(p.id) : p.docId && !submittedDocIds.has(p.docId)));
  }, [quizSubmissions]);

  // Documents and videos come from StudyContext, which already holds the full
  // lists — only submissions and stats can have gone stale since a quiz was
  // taken elsewhere in the app, so those are the only mount-time refreshes.
  useEffect(() => {
    void refreshQuizSubmissions();
    void refreshStats();
  }, [refreshQuizSubmissions, refreshStats]);

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

  // ── Handlers ──────────────────────────────────────────────────────────────────

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
      const questions = await videoService.getQuiz(videoId);
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
      const video = await videoService.getVideo(videoId);
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
        const questions = await videoService.getQuiz(videoId);
        return questions.map(q => ({
          question: q.question, options: q.options ?? [],
          correctAnswer: q.correctAnswer, explanation: q.explanation ?? '',
        }));
      },
      sourceType: 'youtube',
      sourceUrl,
    });
  };

  // ── Derived collections ─────────────────────────────────────────────────────

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
        targetQuizQuestionId: Object.keys(s.answers ?? {})[0],
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
      targetQuizQuestionId: Object.keys(s.answers ?? {})[0],
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

  // ── Export ──────────────────────────────────────────────────────────────────

  const loadQuizRecordsForExport = async (): Promise<ExportQuizRecord[]> => {
    const records: ExportQuizRecord[] = [];
    for (const item of filteredItems.filter(i => !i.pending)) {
      try {
        if (item.type === 'video') {
          const questions = await videoService.getQuiz(item.id);
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

  return {
    // filters / pagination
    courses, sourceType, selectedCourseId, counts, courseCounts, handleFilterChange,
    setSourceType, setSelectedCourseId,
    filteredItems, pagedItems, safePage, totalPages, setPage,
    // items / loading
    documents, allItems, loadingTimedExam, docStats, exporting,
    coverageLoading, pendingLoading, visiblePendingItems, pendingItemsCount,
    // modals
    shareTarget, setShareTarget,
    timedExamDocId, setTimedExamDocId, timedExamDocName, timedExamQuestions,
    // handlers
    handleStartTimedExam, handleStartVideoTimedExam, handleShareQuiz, handleShareVideoQuiz,
    handleExportQuizzes,
    // refreshes (reused by visibility refresh and pending-grid generation)
    refreshQuizSubmissions, refreshStats, refreshDocuments, refreshGeneratedMaterials,
    refreshCoverage, refreshPendingItems, refreshVideos, setGeneratedPending,
  };
}
