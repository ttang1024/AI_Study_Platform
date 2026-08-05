import React, { useEffect, useState } from 'react';
import { useStudy } from '../../context/StudyContext';
import { flashcardService } from '../../services/flashcardService';
import { VideoListItem } from '../../services/videoService';
import { Flashcard } from '../../types';
import { SourceType } from '../../components/common/SourceFilterBar';
import { PendingItem } from '../../components/common/PendingItemsGrid';
import { pendingMaterialToItem } from '../../services/pendingMaterialService';
import { useRefreshOnVisible } from '../../hooks/useRefreshOnVisible';
import { useFlashcardSets, getVideoSetThumbnail } from '../../hooks/useFlashcardSets';
import { useStudyTimer } from '../../hooks/useStudyTimer';

export type VideoRecord = Pick<VideoListItem, 'id' | 'title' | 'thumbnailUrl' | 'courseId' | 'courseName' | 'courseColor'>;

export interface SimpleCard {
  id: string;
  front: string;
  back: string;
  cardType?: Flashcard['cardType'];
  imageUrl?: string;
  occlusions?: Flashcard['occlusions'];
}

const PAGE_SIZE = 6;
const CARD_PAGE_SIZE = 10;

const toSimpleCard = (f: Flashcard): SimpleCard => ({
  id: f.id, front: f.front, back: f.back, cardType: f.cardType, imageUrl: f.imageUrl, occlusions: f.occlusions,
});

/** All state, data loading, and derived lists behind FlashcardsPage. */
export function useFlashcardsPage() {
  const study = useStudy();
  const {
    documents, courses, flashcards, totalMaterials, isLoading: contextLoading,
    refreshFlashcards, refreshStats, refreshDocuments,
    videos: videoList, videosLoading, refreshVideos,
    ensureDocuments, ensureFlashcards, ensureVideos,
  } = study;

  // Flashcards and the video list load lazily — pull them now this page (which
  // renders both) has mounted.
  useEffect(() => { void ensureDocuments(); void ensureFlashcards(); void ensureVideos(); }, [ensureDocuments, ensureFlashcards, ensureVideos]);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [coverageLoading, setCoverageLoading] = useState(true);
  const [coverage, setCoverage] = useState({ documentIds: [] as string[], videoIds: [] as string[] });
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [videoCards, setVideoCards] = useState<SimpleCard[]>([]);

  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Attribute flashcard time to the course of the set being studied, falling back to the
  // course filter when browsing the set list.
  const openSetCourseId = selectedDocId
    ? documents.find(d => d.id === selectedDocId)?.courseId ?? null
    : selectedVideo?.courseId || null;
  useStudyTimer({ contextType: 'flashcards', courseId: openSetCourseId ?? selectedCourseId });

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [cardPage, setCardPage] = useState(1);
  const [mobileReview, setMobileReview] = useState<{ cards: SimpleCard[]; title: string } | null>(null);
  const [classifyCard, setClassifyCard] = useState<Flashcard | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showOcclusionEditor, setShowOcclusionEditor] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [activeTab, setActiveTab] = useState<'sets' | 'review' | 'leeches'>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab === 'review' || tab === 'leeches' ? tab : 'sets';
  });

  // Classification filters
  const [filterDifficulty, setFilterDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const [filterChapter, setFilterChapter] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const refreshCoverage = React.useCallback(() => {
    setCoverageLoading(true);
    return flashcardService.getCoverage()
      .then(setCoverage)
      .catch(() => setCoverage({ documentIds: [], videoIds: [] }))
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
    // This burst is 6 requests (including the full flashcard and document
    // lists), so cap it to once a minute rather than on every quick tab switch.
  ]), 60_000);

  const sets = useFlashcardSets({
    flashcards,
    documents,
    videoList,
    courses,
    sourceType,
    selectedCourseId,
    searchQuery,
    filterDifficulty,
    filterChapter,
    filterTags,
  });

  const classifyFiltersActive = filterDifficulty !== null || filterChapter.trim() !== '' || filterTags.length > 0;

  const handleSelectVideo = (videoId: string) => {
    setVideoCards(flashcards.filter(f => f.videoId === videoId).map(toSimpleCard));
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

  const openMobileReview = (set: { type: string; id: string; name: string }) => {
    const cards = flashcards
      .filter(f => (set.type === 'video' ? f.videoId === set.id : f.documentId === set.id))
      .map(toSimpleCard);
    setMobileReview({ cards, title: set.name });
  };

  /**
   * Cram the current classification filters (difficulty/chapter/tags) right now, ignoring
   * FSRS due dates entirely — the review queue only ever offers due + new cards, so this is
   * the one path to "study everything tagged X" before an exam. Cards are still rated
   * through the normal FlashcardSessionDeck, so FSRS state updates exactly as it would
   * from any other session.
   */
  const startFilteredSession = () => {
    setMobileReview({
      cards: sets.filteredCards.map(toSimpleCard),
      title: [
        filterChapter.trim() || null,
        filterDifficulty ? `${filterDifficulty} difficulty` : null,
        filterTags.length > 0 ? filterTags.map(t => `#${t}`).join(' ') : null,
      ].filter(Boolean).join(' · ') || 'Custom session',
    });
  };

  useEffect(() => { setPage(1); }, [sourceType, selectedCourseId, searchQuery]);
  useEffect(() => { setCardPage(1); }, [filterDifficulty, filterChapter, filterTags, sourceType, selectedCourseId, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(sets.filteredSets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSets = sets.filteredSets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const cardTotalPages = Math.max(1, Math.ceil(sets.filteredCards.length / CARD_PAGE_SIZE));
  const safeCardPage = Math.min(cardPage, cardTotalPages);
  const pagedCards = sets.filteredCards.slice((safeCardPage - 1) * CARD_PAGE_SIZE, safeCardPage * CARD_PAGE_SIZE);

  const pendingItemsCount = Math.max(
    0,
    totalMaterials - coverage.documentIds.length - coverage.videoIds.length,
  );

  const isLoading = contextLoading || videosLoading || coverageLoading || pendingLoading;

  return {
    // context data
    documents, courses, flashcards, videoList,
    refreshFlashcards, refreshStats,
    // loading
    isLoading,
    // detail views
    selectedDocId, setSelectedDocId,
    selectedVideo, setSelectedVideo,
    videoCards, setVideoCards,
    // filters
    sourceType, setSourceType,
    selectedCourseId, setSelectedCourseId,
    searchQuery, setSearchQuery,
    filterDifficulty, setFilterDifficulty,
    filterChapter, setFilterChapter,
    filterTags, setFilterTags,
    classifyFiltersActive,
    // tabs
    activeTab, setActiveTab,
    // sets + cards
    ...sets,
    pagedSets, safePage, totalPages, setPage,
    pagedCards, safeCardPage, cardTotalPages, setCardPage,
    // pending
    pendingItems, pendingItemsCount, refreshCoverage, refreshPendingItems,
    // modals / actions
    mobileReview, setMobileReview, startFilteredSession,
    classifyCard, setClassifyCard,
    showImport, setShowImport,
    showOcclusionEditor, setShowOcclusionEditor,
    exporting, setExporting,
    handleSelectVideo,
    openMobileReview,
  };
}

