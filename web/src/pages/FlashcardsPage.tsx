import React, { useState, useMemo, useEffect } from 'react';
import { useStudy } from '../context/StudyContext';
import { BrainCircuit, FileText, Play, Search, ArrowLeft, Sparkles, Youtube, Loader2, Download, Smartphone, Globe, Mic, Share2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
import { getDocDisplayName } from '../utils/docName';
import { downloadAnkiDeck, downloadCsvDeck } from '../services/ankiExportService';
import { motion, AnimatePresence } from 'motion/react';
import { Flashcards } from '../components/study/Flashcards';
import { MobileFlashcardReview } from '../components/study/MobileFlashcardReview';
import { youtubeService, VideoListItem } from '../services/youtubeService';
import { flashcardService } from '../services/flashcardService';
import { Flashcard } from '../types';
import { SourceFilterBar, SourceType } from '../components/common/SourceFilterBar';
import { PendingItemsGrid, PendingItem } from '../components/common/PendingItemsGrid';
import { Pagination } from '../components/common/Pagination';
import { ShareModal } from '../components/common/ShareModal';
import { pendingMaterialToItem } from '../services/pendingMaterialService';
import { useRefreshOnVisible } from '../hooks/useRefreshOnVisible';

type VideoRecord = Pick<VideoListItem, 'id' | 'title' | 'thumbnailUrl' | 'courseId' | 'courseName' | 'courseColor'>;

interface SimpleCard { id: string; front: string; back: string; }

interface UnifiedSet {
  type: 'doc' | 'video' | 'article' | 'audio';
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  cardCount: number;
  previewText?: string;
  thumbnailUrl?: string;
}

const PAGE_SIZE = 6;

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { opacity: 1, scale: 1, y: 0 },
};

export const FlashcardsPage: React.FC = () => {
  const { documents, courses, flashcards, totalMaterials, isLoading: contextLoading, refreshFlashcards, refreshStats, refreshDocuments } = useStudy();
  const navigate = useNavigate();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [videoList, setVideoList] = useState<VideoListItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
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
  const [mobileReview, setMobileReview] = useState<{ cards: { id: string; front: string; back: string }[]; title: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    title: string;
    cards: { front: string; back: string }[];
    sourceType?: 'youtube' | 'article' | 'audio' | 'podcast' | 'document';
    sourceUrl?: string | null;
    originalArticleUrl?: string | null;
  } | null>(null);

  const refreshVideos = React.useCallback(() => {
    setVideosLoading(true);
    return youtubeService.getVideos({ page: 1, pageSize: 500 })
      .then(data => setVideoList(data.items))
      .catch(() => { })
      .finally(() => setVideosLoading(false));
  }, []);

  useEffect(() => { void refreshVideos(); }, [refreshVideos]);

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
      .map(f => ({ id: f.id, front: f.front, back: f.back }));
    setVideoCards(cards);
    const v = videoList.find(vl => vl.id === videoId);
    setSelectedVideo({
      id: videoId,
      title: v?.title ?? 'Unknown Video',
      thumbnailUrl: v?.thumbnailUrl ?? '',
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
      // Use documentName from API response first (always available), fall back to context lookup
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
        thumbnailUrl: v?.thumbnailUrl,
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

  useEffect(() => { setPage(1); }, [sourceType, selectedCourseId, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSets = filteredSets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  // Detail views
  if (selectedDocId) {
    const selectedDoc = documents.find(d => d.id === selectedDocId);
    return (
      <>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <button
            onClick={() => setSelectedDocId(null)}
            className="group flex items-center gap-2 text-zinc-400 hover:text-primary transition-colors font-bold text-sm uppercase tracking-widest"
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
            Back to Sets
          </button>
          <div className="rounded-[40px] border border-[var(--border-color)] bg-white p-10 shadow-xl shadow-primary/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-[10px] font-black text-primary uppercase tracking-widest border border-primary/20">
                  <BrainCircuit size={12} />
                  Active Recall Mode
                </div>
                <h2 className="text-4xl font-black text-text-main">{selectedDoc?.name}</h2>
                <p className="text-zinc-400 font-medium">Master this set using spaced repetition and active recall.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const cards = flashcards.filter(f => f.documentId === selectedDocId).map(f => ({ id: f.id, front: f.front, back: f.back }));
                      downloadAnkiDeck(cards, selectedDoc?.name ?? 'flashcards');
                    }}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                  >
                    <Download size={14} />
                    Export TXT
                  </button>
                  <button
                    onClick={() => {
                      const cards = flashcards.filter(f => f.documentId === selectedDocId).map(f => ({ id: f.id, front: f.front, back: f.back }));
                      downloadCsvDeck(cards, selectedDoc?.name ?? 'flashcards');
                    }}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                  <button
                    onClick={() => {
                      const cards = flashcards.filter(f => f.documentId === selectedDocId).map(f => ({ front: f.front, back: f.back }));
                      const docType = selectedDoc?.type;
                      const isArticle = !!selectedDoc?.originalUrl;
                      const isAudio = docType === 'audio';
                      const isPodcast = docType === 'podcast';
                      const srcType = isArticle ? 'article' : isAudio ? 'audio' : isPodcast ? 'podcast' : 'document';
                      const srcUrl = selectedDoc?.courseId ? `${selectedDoc.courseId}/${selectedDocId}` : null;
                      setShareTarget({
                        title: selectedDoc?.name ?? 'Flashcards',
                        cards,
                        sourceType: srcType,
                        sourceUrl: srcUrl,
                        originalArticleUrl: isArticle ? (selectedDoc?.originalUrl ?? null) : null,
                      });
                    }}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                  >
                    <Share2 size={14} />
                    Share
                  </button>
                </div>
              </div>
            </div>
            <Flashcards documentId={selectedDocId} />
          </div>
        </motion.div>
        {shareTarget && (
          <ShareModal
            open={!!shareTarget}
            onClose={() => setShareTarget(null)}
            title={shareTarget.title}
            fetchFlashcards={async () => shareTarget.cards}
            sourceType={shareTarget.sourceType}
            sourceUrl={shareTarget.sourceUrl}
            originalArticleUrl={shareTarget.originalArticleUrl}
          />
        )}
      </>
    );
  }

  if (selectedVideo) {
    return (
      <>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <button
            onClick={() => { setSelectedVideo(null); setVideoCards([]); }}
            className="group flex items-center gap-2 text-zinc-400 hover:text-primary transition-colors font-bold text-sm uppercase tracking-widest"
          >
            <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
            Back to Sets
          </button>
          <div className="rounded-[40px] border border-[var(--border-color)] bg-white p-10 shadow-xl shadow-red-500/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-1.5 text-[10px] font-black text-red-500 uppercase tracking-widest border border-red-100">
                  <Youtube size={12} />
                  YouTube · Active Recall Mode
                </div>
                <h2 className="text-4xl font-black text-text-main">{selectedVideo.title}</h2>
                <p className="text-zinc-400 font-medium">Master this video using spaced repetition and active recall.</p>
                <button
                  onClick={() => {
                    const video = videoList.find(v => v.id === selectedVideo.id);
                    setShareTarget({
                      title: selectedVideo.title,
                      cards: videoCards.map(c => ({ front: c.front, back: c.back })),
                      sourceType: 'youtube',
                      sourceUrl: video?.videoUrl ?? null,
                    });
                  }}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium text-text-muted hover:border-primary/50 hover:text-primary transition-all w-fit"
                >
                  <Share2 size={14} />
                  Share
                </button>
              </div>
            </div>
            <Flashcards externalCards={videoCards} />
          </div>
        </motion.div>
        {shareTarget && (
          <ShareModal
            open={!!shareTarget}
            onClose={() => setShareTarget(null)}
            title={shareTarget.title}
            fetchFlashcards={async () => shareTarget.cards}
            sourceType={shareTarget.sourceType}
            sourceUrl={shareTarget.sourceUrl}
            originalArticleUrl={shareTarget.originalArticleUrl}
          />
        )}
      </>
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
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary w-fit border border-primary/20">
            <Sparkles size={14} />
            Mastery Center
          </div>
          <h1 className="text-4xl font-black tracking-tight text-text-main">
            Study <span className="text-primary">Flashcards</span>
          </h1>
          <p className="text-lg text-zinc-500 font-medium max-w-2xl">
            Master your subjects with active recall and spaced repetition.
          </p>
        </div>
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
      </div>

      {/* Filters */}
      <SourceFilterBar
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelectCourse={setSelectedCourseId}
        sourceType={sourceType}
        onSelectType={setSourceType}
        counts={counts}
      />

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
      ) : filteredSets.length === 0 ? (
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
              const cardColor = set.courseColor;
              return (
                <motion.button
                  layout
                  key={`${set.type}-${set.id}`}
                  variants={cardVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => {
                    if (isVideo) {
                      handleSelectVideo(set.id);
                    } else {
                      if (set.id) setSelectedDocId(set.id);
                    }
                  }}
                  className="group relative flex flex-col text-left rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition-all card-hover"
                >
                  {/* Stacked Cards Preview */}
                  <div className="relative h-36 mb-4">
                    {/* Bottom layer */}
                    <div
                      className="absolute inset-x-5 top-4 bottom-0 rounded-xl"
                      style={{ backgroundColor: cardColor, opacity: 0.5, transform: 'rotate(4deg)' }}
                    />
                    {/* Middle layer */}
                    <div
                      className="absolute inset-x-2.5 top-2 bottom-0 rounded-xl"
                      style={{ backgroundColor: cardColor, opacity: 0.25, transform: 'rotate(8deg)' }}
                    />
                    {/* Front card */}
                    <div
                      className="absolute inset-x-0 top-0 bottom-0 rounded-xl flex flex-col items-start justify-between p-3.5 group-hover:scale-[1.02] transition-transform duration-300"
                      style={{ backgroundColor: cardColor, boxShadow: `0 6px 20px ${cardColor}40` }}
                    >
                      {/* First question */}
                      <div className="flex-1 flex items-center justify-center w-full py-1">
                        {set.previewText ? (
                          <p className="text-[11px] font-semibold text-white text-center line-clamp-3 leading-snug px-1">
                            {set.previewText}
                          </p>
                        ) : (
                          <BrainCircuit size={22} className="text-white opacity-40" />
                        )}
                      </div>
                      {/* Card count pill */}
                      <div className="self-end rounded-full bg-white/20 px-2 py-1 flex items-center">
                        <span className="text-[9px] font-bold text-white">{set.cardCount} cards</span>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {set.courseName && (
                        <div className="flex items-center gap-1 mb-1">
                          {set.type === 'video'
                            ? <Youtube size={15} className='text-red-500' />
                            : set.type === 'article'
                              ? <Globe size={13} className='text-teal-500' />
                              : set.type === 'audio'
                                ? <Mic size={13} className='text-amber-500' />
                                : <FileText size={13} className='text-primary' />
                          }
                          <span className="text-[10px] font-bold truncate" style={{ color: cardColor }}>{set.courseName}</span>
                        </div>
                      )}
                      <p className="text-xs font-bold text-text-main truncate">{set.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          const cards = isVideo
                            ? flashcards.filter(f => f.youTubeVideoId === set.id).map(f => ({ id: f.id, front: f.front, back: f.back }))
                            : flashcards.filter(f => f.documentId === set.id).map(f => ({ id: f.id, front: f.front, back: f.back }));
                          setMobileReview({ cards, title: set.name });
                        }}
                        className="rounded-xl border border-zinc-200 p-2 text-text-muted hover:border-primary/50 hover:text-primary transition-all"
                        title="Mobile review"
                      >
                        <Smartphone size={13} />
                      </div>
                      <div
                        className="rounded-xl p-2 text-white shrink-0 opacity-75 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: cardColor }}
                      >
                        <Play size={13} />
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        size="sm"
      />

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

      {mobileReview && (
        <MobileFlashcardReview
          cards={mobileReview.cards}
          title={mobileReview.title}
          onClose={() => setMobileReview(null)}
        />
      )}

      {shareTarget && (
        <ShareModal
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
          title={shareTarget.title}
          fetchFlashcards={async () => shareTarget.cards}
          sourceType={shareTarget.sourceType}
          sourceUrl={shareTarget.sourceUrl}
          originalArticleUrl={shareTarget.originalArticleUrl}
        />
      )}
    </motion.div>
  );
};
