import { useEffect, useState } from 'react';
import { GlossaryTerm } from '../types';
import { glossaryService } from '../services/glossaryService';
import type { Document as StudyDocument } from '../types';
import type { VideoListItem } from '../services/videoService';

export function getDocKind(doc: { type?: string; name: string; originalUrl?: string }): 'audio' | 'article' | 'document' {
  if (doc.type === 'audio' || doc.type === 'podcast') return 'audio';
  if (doc.originalUrl) return 'article';
  return 'document';
}

/**
 * Glossary term data + mutations for the glossary page: bulk load, per-source
 * generation, and inline edit/delete of individual terms.
 */
export const useGlossaryTerms = (userId: string, documents: StudyDocument[], videos: VideoListItem[]) => {
  const [allTerms, setAllTerms] = useState<GlossaryTerm[]>([]);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ term: '', definition: '' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load cached glossary terms in one request. Per-source endpoints are only used for refresh/generate.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const terms = await glossaryService.getAllGlossary();
      if (!cancelled) setAllTerms(terms);
    };
    if (userId !== 'guest') load();
    return () => { cancelled = true; };
  }, [userId]);

  const handleGenerateDoc = async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    setGenerating(prev => new Set([...prev, docId]));
    try {
      const terms = await glossaryService.generateGlossary(doc.courseId || '', doc.id);
      const enriched = terms.map(t => ({
        ...t,
        documentId: doc.id,
        sourceName: doc.name,
        courseId: doc.courseId,
        sourceKind: getDocKind(doc) as GlossaryTerm['sourceKind'],
      }));
      setAllTerms(prev => [...prev.filter(t => t.documentId !== docId), ...enriched]);
    } finally {
      setGenerating(prev => { const n = new Set(prev); n.delete(docId); return n; });
    }
  };

  const handleGenerateVideo = async (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    setGenerating(prev => new Set([...prev, videoId]));
    try {
      const terms = await glossaryService.generateVideoGlossary(videoId, video.videoUrl);
      const enriched = terms.map(t => ({
        ...t,
        youTubeVideoId: videoId,
        sourceName: video.title,
        courseId: video.courseId,
        sourceKind: 'video' as const,
      }));
      setAllTerms(prev => [...prev.filter(t => t.youTubeVideoId !== videoId), ...enriched]);
    } finally {
      setGenerating(prev => { const n = new Set(prev); n.delete(videoId); return n; });
    }
  };

  const startEdit = (term: GlossaryTerm) => {
    setEditingId(term.id);
    setEditDraft({ term: term.term, definition: term.definition });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (termId: string) => {
    setSavingId(termId);
    try {
      const updated = await glossaryService.updateTerm(termId, editDraft.term, editDraft.definition);
      setAllTerms(prev => prev.map(t =>
        t.id === termId ? { ...t, term: updated.term, definition: updated.definition } : t
      ));
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (termId: string) => {
    setDeletingId(termId);
    try {
      await glossaryService.deleteTerm(termId);
      setAllTerms(prev => prev.filter(t => t.id !== termId));
    } finally {
      setDeletingId(null);
    }
  };

  return {
    allTerms,
    generating, handleGenerateDoc, handleGenerateVideo,
    editingId, editDraft, setEditDraft, savingId, deletingId,
    startEdit, cancelEdit, saveEdit, handleDelete,
  };
};
