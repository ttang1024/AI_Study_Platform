import { useMemo } from 'react';
import { Flashcard, Document, Course } from '../types';
import { VideoListItem, videoService } from '../services/videoService';
import { SourceType } from '../components/common/SourceFilterBar';
import { getDocDisplayName, documentSourceKind } from '../utils/docName';
import { UnifiedSet } from '../components/study/FlashcardSetCard';

export function getVideoSetThumbnail(video?: VideoListItem) {
  if (!video) return undefined;
  if (video.sourceType === 'upload') return videoService.getUploadedVideoThumbnailUrl(video.id);
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.sourceType === 'bilibili') return '/images/bilibili.png';
  return video.videoId ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg` : undefined;
}

function getVideoSetPreview(video?: VideoListItem) {
  return video?.sourceType === 'upload' ? videoService.getUploadedVideoStreamUrl(video.id) : undefined;
}

interface UseFlashcardSetsParams {
  flashcards: Flashcard[];
  documents: Document[];
  videoList: VideoListItem[];
  courses: Course[];
  sourceType: SourceType;
  selectedCourseId: string | null;
  searchQuery: string;
  filterDifficulty: 'easy' | 'medium' | 'hard' | null;
  filterChapter: string;
  filterTags: string[];
}

/** Derives flashcard "sets" (grouped by document/video) and the filtered set/card lists from raw study data. */
export function useFlashcardSets({
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
}: UseFlashcardSetsParams) {
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

  const videoSets = useMemo(() => {
    const map = new Map<string, Flashcard[]>();
    for (const f of flashcards) {
      if (!f.videoId) continue;
      if (!map.has(f.videoId)) map.set(f.videoId, []);
      map.get(f.videoId)!.push(f);
    }
    return Array.from(map.entries()).map(([videoId, cards]) => ({ videoId, cards }));
  }, [flashcards]);

  const docSets = useMemo(() => {
    const map = new Map<string, Flashcard[]>();
    for (const f of flashcards) {
      if (f.videoId) continue; // skip video flashcards
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
      const type: UnifiedSet['type'] = documentSourceKind(doc);
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

  const filteredCards = useMemo(() => {
    let cards = flashcards;
    if (sourceType === 'video') cards = cards.filter(f => !!f.videoId);
    else if (sourceType === 'document') cards = cards.filter(f => {
      if (f.videoId) return false;
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
        const vid = videoList.find(v => v.id === f.videoId);
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

  return { allTags, allChapters, allSets, filteredSets, filteredCards, counts, courseCounts };
}
