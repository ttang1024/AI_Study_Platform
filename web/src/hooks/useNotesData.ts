import { useState, useEffect, useMemo, useCallback } from 'react';
import { Note, Document, Course } from '../types';
import { VideoListItem } from '../services/videoService';
import { SourceType } from '../components/common/SourceFilterBar';
import { getDocDisplayName } from '../utils/docName';

export interface VideoNoteEntry {
  noteId: string;
  videoRecordId: string;
  title: string;
  courseId: string;
  courseColor: string;
  courseName: string;
  content: string;
  createdAt: string;
}

export type UnifiedNoteItem =
  | { type: 'doc' | 'article' | 'audio'; note: Note; docName: string; courseId: string; courseName: string; courseColor: string; docId?: string }
  | { type: 'video'; entry: VideoNoteEntry };

export const itemId = (item: UnifiedNoteItem) => (item.type !== 'video' ? item.note.id : item.entry.noteId);

interface UseNotesDataParams {
  allNotes: Note[];
  videoList: VideoListItem[];
  documents: Document[];
  courses: Course[];
  searchQuery: string;
  sourceType: SourceType;
  selectedCourseId: string | null;
}

/** Derives the unified doc+video note list, filters, counts, and multi-select state from raw study data. */
export function useNotesData({
  allNotes, videoList, documents, courses, searchQuery, sourceType, selectedCourseId,
}: UseNotesDataParams) {
  const [videoNotes, setVideoNotes] = useState<VideoNoteEntry[]>([]);

  useEffect(() => {
    const entries: VideoNoteEntry[] = allNotes
      .filter(n => n.videoId)
      .map(n => {
        const video = videoList.find(v => v.id === n.videoId);
        return {
          noteId: n.id,
          videoRecordId: n.videoId!,
          title: video?.title ?? n.videoName ?? 'Unknown Video',
          courseId: video?.courseId ?? '',
          courseColor: video?.courseColor ?? '#a1a1aa',
          courseName: video?.courseName ?? '',
          content: n.content,
          createdAt: n.createdAt,
        };
      });
    setVideoNotes(entries);
  }, [allNotes, videoList]);

  const filteredDocNotes = useMemo(() => {
    const docOnly = allNotes.filter(n => !n.videoId);
    if (!searchQuery.trim()) return docOnly;
    const q = searchQuery.toLowerCase();
    return docOnly.filter(n => n.content.toLowerCase().includes(q));
  }, [allNotes, searchQuery]);

  const allItems = useMemo<UnifiedNoteItem[]>(() => {
    const docItems: UnifiedNoteItem[] = filteredDocNotes.map(note => {
      const doc = documents.find(d => d.id === note.documentId);
      const course = courses.find(c => c.id === doc?.courseId);
      // Use documentName from API response first, fall back to context lookup
      const docName = doc ? getDocDisplayName(doc) : (note.documentName ?? 'Unknown Document');
      const type: 'doc' | 'article' | 'audio' = (doc?.type === 'audio' || doc?.type === 'podcast') ? 'audio' : doc?.originalUrl ? 'article' : 'doc';
      return {
        type,
        note,
        docName,
        courseId: doc?.courseId ?? '',
        courseName: course?.name ?? '',
        courseColor: course?.color ?? '#a1a1aa',
        docId: doc?.id,
      };
    });
    const q = searchQuery.toLowerCase().trim();
    const filteredVideoNotes = q
      ? videoNotes.filter(v => v.content.toLowerCase().includes(q) || v.title.toLowerCase().includes(q))
      : videoNotes;
    const videoItems: UnifiedNoteItem[] = filteredVideoNotes.map(entry => ({ type: 'video', entry }));
    return [...docItems, ...videoItems];
  }, [filteredDocNotes, videoNotes, documents, courses, searchQuery]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (sourceType === 'document') items = items.filter(i => i.type === 'doc');
    else if (sourceType === 'video') items = items.filter(i => i.type === 'video');
    else if (sourceType === 'article') items = items.filter(i => i.type === 'article');
    else if (sourceType === 'audio') items = items.filter(i => i.type === 'audio');
    if (selectedCourseId) {
      items = items.filter(i =>
        i.type !== 'video' ? i.courseId === selectedCourseId : i.entry.courseId === selectedCourseId
      );
    }
    return items;
  }, [allItems, sourceType, selectedCourseId]);

  const counts = useMemo(() => ({
    all: allItems.length,
    document: allItems.filter(i => i.type === 'doc').length,
    video: allItems.filter(i => i.type === 'video').length,
    article: allItems.filter(i => i.type === 'article').length,
    audio: allItems.filter(i => i.type === 'audio').length,
  }), [allItems]);

  const courseCounts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const item of allItems) {
      const courseId = item.type === 'video' ? item.entry.courseId : item.courseId;
      if (!courseId) continue;
      next[courseId] = (next[courseId] ?? 0) + 1;
    }
    return next;
  }, [allItems]);

  // ── multi-select ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Drop selections that no longer match the active filters
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const visible = new Set(filteredItems.map(itemId));
      const next = new Set([...prev].filter(id => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredItems]);

  const allVisibleSelected = filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(itemId(i)));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const allSelected = filteredItems.length > 0 && filteredItems.every(i => prev.has(itemId(i)));
      return allSelected ? new Set() : new Set(filteredItems.map(itemId));
    });
  }, [filteredItems]);

  return {
    videoNotes, setVideoNotes,
    allItems, filteredItems, counts, courseCounts,
    selectedIds, setSelectedIds, toggleSelect, toggleSelectAll, allVisibleSelected,
  };
}
