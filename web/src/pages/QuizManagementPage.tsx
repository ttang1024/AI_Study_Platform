import React, { useState, useMemo, useEffect } from 'react';
import { useStudy } from '../context/StudyContext';
import { Sparkles, Award, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getDocDisplayName } from '../utils/docName';
import { SourceFilterBar, SourceType } from '../components/common/SourceFilterBar';
import { PendingItemsGrid, PendingItem } from '../components/common/PendingItemsGrid';
import { youtubeService, VideoListItem } from '../services/youtubeService';
import { ShareableQuiz } from '../services/shareContentService';
import { ShareModal } from '../components/common/ShareModal';
import { documentService, quizSubmissionService } from '../services/documentService';
import { TimedExamModal } from '../components/quiz/TimedExamModal';
import { QuizItemRow, QuizItemType } from '../components/quiz/QuizItemRow';
import { QuizQuestion, Document } from '../types';
import { PendingMaterial, pendingMaterialToItem } from '../services/pendingMaterialService';
import { Pagination } from '../components/common/Pagination';
import { useRefreshOnVisible } from '../hooks/useRefreshOnVisible';
import { usePrompt } from '../components/common/PromptBox';

const PAGE_SIZE = 5;

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
  /** true when quiz was generated but never submitted */
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

export const QuizManagementPage: React.FC = () => {
  const { documents, courses, quizSubmissions, totalMaterials, totalQuizSubmissions, achievementStats, isLoading: contextLoading, refreshQuizSubmissions, refreshStats, refreshDocuments } = useStudy();
  const navigate = useNavigate();
  const { showPrompt } = usePrompt();

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

  // Remove pending entries once a real submission arrives for the same doc
  useEffect(() => {
    const submittedDocIds = new Set(quizSubmissions.map(s => s.documentId).filter(Boolean));
    const submittedVideoIds = new Set(quizSubmissions.map(s => s.youTubeVideoId).filter(Boolean));
    setGeneratedPending(prev => prev.filter(p => p.type === 'video' ? !submittedVideoIds.has(p.id) : p.docId && !submittedDocIds.has(p.docId)));
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
  }, [
    refreshQuizSubmissions,
    refreshStats,
    refreshDocuments,
    refreshGeneratedMaterials,
    refreshCoverage,
    refreshPendingItems,
    refreshVideos,
  ]));

  // ─── Handlers ────────────────────────────────────────────────────────────────

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

  // ─── Data ─────────────────────────────────────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary w-fit border border-primary/20">
            <Sparkles size={14} />
            Performance
          </div>
          <h1 className="text-4xl font-black tracking-tight text-text-main">
            Quiz <span className="text-primary">History</span>
          </h1>
          <p className="text-lg text-zinc-500 font-medium max-w-2xl">
            Track your progress and sharpen your knowledge.
          </p>
        </div>
        {docStats.totalTaken > 0 && (
          <div className="flex items-center gap-3 shrink-0">
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
      </div>

      {/* Filters */}
      <SourceFilterBar
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelectCourse={id => handleFilterChange(() => setSelectedCourseId(id))}
        sourceType={sourceType}
        onSelectType={t => handleFilterChange(() => setSourceType(t))}
        counts={counts}
      />

      {/* Quiz list */}
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

      {/* Not yet quizzed */}
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

      <TimedExamModal
        isOpen={timedExamDocId !== null}
        onClose={() => setTimedExamDocId(null)}
        questions={timedExamQuestions}
        sourceTitle={timedExamDocName}
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
