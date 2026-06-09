import React, { useState, useMemo, useEffect } from 'react';
import { useStudy } from '../context/StudyContext';
import { BrainCircuit, Search, Loader2, Pencil, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
import { getDocDisplayName } from '../utils/docName';
import { motion, AnimatePresence } from 'motion/react';
import { FlashcardSessionDeck } from '../components/study/FlashcardSessionCard';
import { FlashcardDetailView } from '../components/study/FlashcardDetailView';
import { videoService, VideoListItem } from '../services/videoService';
import { flashcardService } from '../services/flashcardService';
import { Flashcard } from '../types';
import { SourceFilterBar, SourceType } from '../components/common/SourceFilterBar';
import { PendingItemsGrid, PendingItem } from '../components/common/PendingItemsGrid';
import { Pagination } from '../components/common/Pagination';
import { pendingMaterialToItem } from '../services/pendingMaterialService';
import { useRefreshOnVisible } from '../hooks/useRefreshOnVisible';
import { FlashcardClassifyModal, DIFFICULTY_COLORS } from '../components/study/FlashcardClassifyModal';
import { ReviewQueueTab } from '../components/study/ReviewQueueTab';
import { ClassifyFilterBar } from '../components/study/ClassifyFilterBar';
import { FlashcardSetCard, UnifiedSet } from '../components/study/FlashcardSetCard';
import { useStudyTimer } from '../hooks/useStudyTimer';

type VideoRecord = Pick<VideoListItem, 'id' | 'title' | 'thumbnailUrl' | 'courseId' | 'courseName' | 'courseColor'>;

interface SimpleCard { id: string; front: string; back: string; }

const PAGE_SIZE = 6;
const CARD_PAGE_SIZE = 10;

function getVideoSetThumbnail(video?: VideoListItem) {
  if (!video) return undefined;
  if (video.sourceType === 'upload') return videoService.getUploadedVideoThumbnailUrl(video.id);
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.sourceType === 'bilibili') return '/images/bilibili.png';
  return video.videoId ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg` : undefined;
}

function getVideoSetPreview(video?: VideoListItem) {
  return video?.sourceType === 'upload' ? videoService.getUploadedVideoStreamUrl(video.id) : undefined;
}

export const FlashcardsPage: React.FC = () => {
  const { documents, courses, flashcards, totalMaterials, isLoading: contextLoading, refreshFlashcards, refreshStats, refreshDocuments, videos: videoList, videosLoading, refreshVideos } = useStudy();
  const navigate = useNavigate();
  useStudyTimer({ contextType: 'flashcards' });
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [coverageLoading, setCoverageLoading] = useState(true);
  const [coverage, setCoverage] = useState({ documentIds: [] as string[], youTubeVideoIds: [] as string[] });
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [videoCards, setVideoCards] = useState<SimpleCard[]>([]);

  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [cardPage, setCardPage] = useState(1);
  const [mobileReview, setMobileReview] = useState<{ cards: { id: string; front: string; back: string; cardType?: 'basic' | 'cloze' | 'chart' }[]; title: string } | null>(null);
  const [classifyCard, setClassifyCard] = useState<Flashcard | null>(null);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'sets' | 'review'>(
    () => (new URLSearchParams(window.location.search).get('tab') === 'review' ? 'review' : 'sets'),
  );

  // Classification filters
  const [filterDifficulty, setFilterDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const [filterChapter, setFilterChapter] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // `videoList`/`videosLoading`/`refreshVideos` come from StudyContext, which loads
  // the lightweight video list once and shares it across pages.

  const refreshCoverage = React.useCallback(() => {
    setCoverageLoading(true);
    return flashcardService.getCoverage()
      .then(setCoverage)
      .catch(() => setCoverage({ documentIds: [], youTubeVideoIds: [] }))
      .finally(() => setCoverageLoading(false));
  }, []);

  useEffect(() => { void refreshCoverage(); }, [refreshCoverage]);

  const refreshPendingItems = React.useCallback(() => {
    setPendingLoading(true);
    return flashcardService.getPendingMaterials()
      .then(items => setPendingItems(items.map(pendingMaterialToItem)))
      .catch(() => setPendingItems([]))
      .finally(() => setPendingLoading(false));
  }, []);

  useEffect(() => { void refreshPendingItems(); }, [refreshPendingItems]);

  useRefreshOnVisible(React.useCallback(async () => {
    await Promise.all([
      refreshFlashcards(),
      refreshStats(),
      refreshDocuments(),
      refreshCoverage(),
      refreshPendingItems(),
      refreshVideos(),
    ]);
  }, [
    refreshFlashcards,
    refreshStats,
    refreshDocuments,
    refreshCoverage,
    refreshPendingItems,
    refreshVideos,
  ]));

  // Derived tag/chapter lists for autocomplete
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of flashcards) f.tags?.forEach(t => set.add(t));
    return Array.from(set).sort();
  }, [flashcards]);

  const allChapters = useMemo(() => {
    const set = new Set<string>();
    for (const f of flashcards) { if (f.chapter) set.add(f.chapter); }
    return Array.from(set).sort();
  }, [flashcards]);

  const classifyFiltersActive = filterDifficulty !== null || filterChapter.trim() !== '' || filterTags.length > 0;

  // Group video flashcards (from context) by youTubeVideoId
  const videoSets = useMemo(() => {
    const map = new Map<string, Flashcard[]>();
    for (const f of flashcards) {
      if (!f.youTubeVideoId) continue;
      if (!map.has(f.youTubeVideoId)) map.set(f.youTubeVideoId, []);
      map.get(f.youTubeVideoId)!.push(f);
    }
    return Array.from(map.entries()).map(([videoId, cards]) => ({ videoId, cards }));
  }, [flashcards]);

  const handleSelectVideo = (videoId: string) => {
    const cards = flashcards
      .filter(f => f.youTubeVideoId === videoId)
      .map(f => ({ id: f.id, front: f.front, back: f.back, cardType: f.cardType }));
    setVideoCards(cards);
    const v = videoList.find(vl => vl.id === videoId);
    setSelectedVideo({
      id: videoId,
      title: v?.title ?? 'Unknown Video',
      thumbnailUrl: getVideoSetThumbnail(v) ?? '',
      courseId: v?.courseId ?? '',
      courseName: v?.courseName ?? '',
      courseColor: v?.courseColor ?? '#a1a1aa',
    });
  };

  const docSets = useMemo(() => {
    const map = new Map<string, Flashcard[]>();
    for (const f of flashcards) {
      if (f.youTubeVideoId) continue; // skip video flashcards
      const key = f.documentId || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).map(([docId, cards]) => ({
      docId: docId === '__none__' ? '' : docId,
      cards,
    }));
  }, [flashcards]);

  const allSets = useMemo<UnifiedSet[]>(() => {
    const docItems: UnifiedSet[] = docSets.map(({ docId, cards }) => {
      const doc = documents.find(d => d.id === docId);
      const course = courses.find(c => c.id === doc?.courseId);
      const name = doc ? getDocDisplayName(doc) : (cards[0]?.documentName ?? 'Unknown Document');
      const type: UnifiedSet['type'] = (doc?.type === 'audio' || doc?.type === 'podcast') ? 'audio' : doc?.originalUrl ? 'article' : 'doc';
      return {
        type,
        id: docId,
        name,
        courseId: doc?.courseId ?? '',
        courseName: course?.name ?? '',
        courseColor: course?.color ?? '#a1a1aa',
        cardCount: cards.length,
        clozeCount: cards.filter(c => c.cardType === 'cloze').length,
        previewText: cards[0]?.front,
      };
    });
    const videoItems: UnifiedSet[] = videoSets.map(({ videoId, cards }) => {
      const v = videoList.find(vl => vl.id === videoId);
      return {
        type: 'video',
        id: videoId,
        name: v?.title ?? cards[0]?.videoName ?? 'Unknown Video',
        courseId: v?.courseId ?? '',
        courseName: v?.courseName ?? '',
        courseColor: v?.courseColor ?? '#a1a1aa',
        cardCount: cards.length,
        clozeCount: cards.filter(c => c.cardType === 'cloze').length,
        thumbnailUrl: getVideoSetThumbnail(v),
        videoPreviewUrl: getVideoSetPreview(v),
        previewText: cards[0]?.front,
      };
    });
    return [...docItems, ...videoItems];
  }, [docSets, videoSets, videoList, documents, courses]);

  const filteredSets = useMemo(() => {
    let items = allSets;
    if (sourceType === 'document') items = items.filter(s => s.type === 'doc');
    else if (sourceType === 'video') items = items.filter(s => s.type === 'video');
    else if (sourceType === 'article') items = items.filter(s => s.type === 'article');
    else if (sourceType === 'audio') items = items.filter(s => s.type === 'audio');
    if (selectedCourseId) items = items.filter(s => s.courseId === selectedCourseId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(s => s.name.toLowerCase().includes(q));
    }
    return items;
  }, [allSets, sourceType, selectedCourseId, searchQuery]);

  // Flat card list for classify filter view
  const filteredCards = useMemo(() => {
    let cards = flashcards;
    if (sourceType === 'video') cards = cards.filter(f => !!f.youTubeVideoId);
    else if (sourceType === 'document') cards = cards.filter(f => {
      if (f.youTubeVideoId) return false;
      const doc = documents.find(d => d.id === f.documentId);
      return !!doc && !doc.originalUrl && doc.type !== 'audio' && doc.type !== 'podcast';
    });
    else if (sourceType === 'article') cards = cards.filter(f => {
      const doc = documents.find(d => d.id === f.documentId);
      return !!doc?.originalUrl;
    });
    else if (sourceType === 'audio') cards = cards.filter(f => {
      const doc = documents.find(d => d.id === f.documentId);
      return doc?.type === 'audio' || doc?.type === 'podcast';
    });
    if (selectedCourseId) {
      cards = cards.filter(f => {
        const doc = documents.find(d => d.id === f.documentId);
        const vid = videoList.find(v => v.id === f.youTubeVideoId);
        return doc?.courseId === selectedCourseId || vid?.courseId === selectedCourseId;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(f => f.front.toLowerCase().includes(q) || f.back.toLowerCase().includes(q));
    }
    if (filterDifficulty) cards = cards.filter(f => f.difficulty === filterDifficulty);
    if (filterChapter.trim()) {
      const ch = filterChapter.toLowerCase();
      cards = cards.filter(f => f.chapter?.toLowerCase().includes(ch));
    }
    if (filterTags.length > 0) cards = cards.filter(f => filterTags.every(t => f.tags?.includes(t)));
    return cards;
  }, [flashcards, sourceType, selectedCourseId, searchQuery, filterDifficulty, filterChapter, filterTags, documents, videoList]);

  useEffect(() => { setPage(1); }, [sourceType, selectedCourseId, searchQuery]);
  useEffect(() => { setCardPage(1); }, [filterDifficulty, filterChapter, filterTags, sourceType, selectedCourseId, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSets = filteredSets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const cardTotalPages = Math.max(1, Math.ceil(filteredCards.length / CARD_PAGE_SIZE));
  const safeCardPage = Math.min(cardPage, cardTotalPages);
  const pagedCards = filteredCards.slice((safeCardPage - 1) * CARD_PAGE_SIZE, safeCardPage * CARD_PAGE_SIZE);

  const pendingItemsCount = Math.max(
    0,
    totalMaterials - coverage.documentIds.length - coverage.youTubeVideoIds.length,
  );

  const counts = useMemo(() => ({
    all: allSets.length,
    document: allSets.filter(s => s.type === 'doc').length,
    video: allSets.filter(s => s.type === 'video').length,
    article: allSets.filter(s => s.type === 'article').length,
    audio: allSets.filter(s => s.type === 'audio').length,
  }), [allSets]);

  const courseCounts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const set of allSets) {
      if (!set.courseId) continue;
      next[set.courseId] = (next[set.courseId] ?? 0) + 1;
    }
    return next;
  }, [allSets]);

  // Detail views
  if (selectedDocId) {
    return (
      <FlashcardDetailView
        kind="doc"
        docId={selectedDocId}
        doc={documents.find(d => d.id === selectedDocId)}
        flashcards={flashcards}
        onBack={() => setSelectedDocId(null)}
      />
    );
  }

  if (selectedVideo) {
    return (
      <FlashcardDetailView
        kind="video"
        video={selectedVideo}
        videoCards={videoCards}
        videoList={videoList}
        onBack={() => { setSelectedVideo(null); setVideoCards([]); }}
      />
    );
  }

  const isLoading = contextLoading || videosLoading || coverageLoading || pendingLoading;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-black tracking-tight text-text-main">
            Study <span className="text-primary">Flashcards</span>
          </h1>
          <p className="text-lg text-zinc-500 font-medium max-w-2xl">
            Master your subjects with active recall and spaced repetition.
          </p>
        </div>
        {activeTab === 'sets' && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search sets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--primary)] transition-all"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl  p-1  w-fit">
        {([
          { id: 'sets', label: 'My Sets', icon: BrainCircuit },
          { id: 'review', label: 'Review Queue', icon: CalendarDays },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all',
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-text-main shadow-sm'
                : 'text-text-muted hover:text-text-main',
            )}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'review' && (
        <ReviewQueueTab flashcards={flashcards} />
      )}

      {activeTab === 'sets' && <>
        {/* Source + Course Filters */}
        <SourceFilterBar
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSelectCourse={setSelectedCourseId}
          sourceType={sourceType}
          onSelectType={setSourceType}
          counts={counts}
          courseCounts={courseCounts}
          hideTypeTabs={true}
        />

        {/* Classification Filters */}
        <ClassifyFilterBar
          allTags={allTags}
          filterDifficulty={filterDifficulty}
          onDifficultyChange={setFilterDifficulty}
          filterChapter={filterChapter}
          onChapterChange={setFilterChapter}
          filterTags={filterTags}
          onTagsChange={setFilterTags}
          filteredCardCount={filteredCards.length}
        />

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : classifyFiltersActive ? (
          /* ── Flat card list view (when classify filters active) ─────── */
          filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center bg-[var(--bg-sidebar)]">
              <div className="mb-4 rounded-2xl bg-zinc-100 p-6 text-zinc-300"><BrainCircuit size={40} /></div>
              <h3 className="text-lg font-bold text-text-main">No cards match your filters</h3>
              <p className="text-zinc-400 text-sm max-w-xs mx-auto mt-2">Try adjusting or clearing the filters above.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pagedCards.map(card => {
                  const doc = documents.find(d => d.id === card.documentId);
                  const vid = videoList.find(v => v.id === card.youTubeVideoId);
                  const sourceName = doc ? getDocDisplayName(doc) : vid?.title ?? card.documentName ?? card.videoName ?? '';
                  const isFlipped = flippedCards.has(card.id);
                  return (
                    <motion.div
                      key={card.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setFlippedCards(prev => {
                        const next = new Set(prev);
                        next.has(card.id) ? next.delete(card.id) : next.add(card.id);
                        return next;
                      })}
                      className="flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 hover:border-[var(--primary)]/30 transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-main line-clamp-2">{card.front}</p>
                        <AnimatePresence>
                          {isFlipped && (
                            <motion.p
                              key="back"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="text-sm text-text-muted mt-2 pt-2 border-t border-[var(--border-color)] overflow-hidden"
                            >
                              {card.back}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold border', DIFFICULTY_COLORS[card.difficulty])}>
                            {card.difficulty}
                          </span>
                          {card.chapter && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {card.chapter}
                            </span>
                          )}
                          {card.tags?.map(t => (
                            <span key={t} className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                              #{t}
                            </span>
                          ))}
                          {sourceName && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const state = { activeTab: 'flashcards' };
                                if (card.youTubeVideoId) {
                                  navigate(`/videos/${card.youTubeVideoId}`, { state });
                                } else if (doc?.originalUrl) {
                                  navigate(`/articles/${card.documentId}`, { state });
                                } else if (doc?.type === 'audio' || doc?.type === 'podcast') {
                                  navigate(`/audio/${card.documentId}`, { state });
                                } else if (card.documentId) {
                                  navigate(`/documents/${card.documentId}`, { state });
                                }
                              }}
                              className="text-[10px] text-text-muted ml-0.5 hover:text-[var(--primary)] hover:underline transition-colors"
                            >
                              {sourceName}
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setClassifyCard(card); }}
                        className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-[var(--bg-sidebar)] hover:text-[var(--primary)] transition-colors"
                        title="Edit classification"
                      >
                        <Pencil size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
              <Pagination
                page={safeCardPage}
                totalPages={cardTotalPages}
                onPageChange={(p) => { setCardPage(p); document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                size="sm"
              />
            </>
          )
        ) : filteredSets.length === 0 ? (
          /* ── Empty set state ─────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center bg-[var(--bg-sidebar)]">
            <div className="mb-4 rounded-2xl bg-zinc-100 p-6 text-zinc-300"><BrainCircuit size={40} /></div>
            <h3 className="text-lg font-bold text-text-main">No flashcard sets found</h3>
            <p className="text-zinc-400 text-sm max-w-xs mx-auto mt-2">
              {searchQuery ? 'Try a different search term.' : 'Generate flashcards from a document or video to start learning.'}
            </p>
            {!searchQuery && allSets.length === 0 && (
              <button
                onClick={() => navigate(documents.length > 0 ? '/library' : '/summarizer')}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
              >
                {documents.length > 0 ? 'Go to Library' : 'Add Content'}
              </button>
            )}
          </div>
        ) : (
          /* ── Set grid ────────────────────────────────────────────────── */
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${sourceType}-${selectedCourseId}-${safePage}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {pagedSets.map((set) => {
                const isVideo = set.type === 'video';
                return (
                  <FlashcardSetCard
                    key={`${set.type}-${set.id}`}
                    set={set}
                    onSelect={() => {
                      if (isVideo) handleSelectVideo(set.id);
                      else if (set.id) setSelectedDocId(set.id);
                    }}
                    onMobileReview={() => {
                      const cards = isVideo
                        ? flashcards.filter(f => f.youTubeVideoId === set.id).map(f => ({ id: f.id, front: f.front, back: f.back, cardType: f.cardType }))
                        : flashcards.filter(f => f.documentId === set.id).map(f => ({ id: f.id, front: f.front, back: f.back, cardType: f.cardType }));
                      setMobileReview({ cards, title: set.name });
                    }}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {!classifyFiltersActive && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            size="sm"
          />
        )}

        {!isLoading && (
          <PendingItemsGrid
            items={pendingItems}
            label="Not Yet Generated"
            activeTab="flashcards"
            ctaText="Generate"
            courses={courses}
            countOverride={pendingItemsCount}
            onGenerated={() => {
              refreshFlashcards();
              void refreshCoverage();
              void refreshPendingItems();
            }}
          />
        )}
      </>}

      {mobileReview && (
        <FlashcardSessionDeck
          cards={mobileReview.cards}
          title={mobileReview.title}
          onClose={() => setMobileReview(null)}
        />
      )}

      {classifyCard && (
        <FlashcardClassifyModal
          card={classifyCard}
          allTags={allTags}
          allChapters={allChapters}
          onSave={async (data) => {
            await flashcardService.classifyFlashcard(classifyCard.id, data);
            await refreshFlashcards();
          }}
          onDelete={async () => {
            await flashcardService.deleteFlashcard(classifyCard.id);
            await refreshFlashcards();
          }}
          onClose={() => setClassifyCard(null)}
        />
      )}
    </motion.div>
  );
};
