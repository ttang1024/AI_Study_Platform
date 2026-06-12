import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStudy } from '../context/StudyContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import {
  BookMarked, Search, Sparkles, Loader2, Play,
  FileText, Youtube, Globe, Mic,
  CheckCircle2, Circle, Share2, X, Download,
} from 'lucide-react';
import { GlossaryTerm } from '../types';
import { glossaryService } from '../services/glossaryService';
import { synthesizeToBlob, downloadAudioBlob } from '../services/edgeTtsService';
import { masteredService } from '../services/masteredService';
import { cn } from '../utils/cn';
import { getDocDisplayName } from '../utils/docName';
import { usePersistentTts } from '../context/TtsContext';
import { SourceFilterBar, SourceType } from '../components/common/SourceFilterBar';
import { GlossaryShareModal } from '../components/common/GlossaryShareModal';
import { GlossaryTermCard } from '../components/common/GlossaryTermCard';
import { Pagination } from '../components/common/Pagination';
import { Select } from '../components/common/Select';
import { useStudyTimer } from '../hooks/useStudyTimer';

function getDocKind(doc: { type?: string; name: string; originalUrl?: string }): 'audio' | 'article' | 'document' {
  if (doc.type === 'audio' || doc.type === 'podcast') return 'audio';
  if (doc.originalUrl) return 'article';
  return 'document';
}

type MasteryFilter = 'all' | 'unmastered' | 'mastered';

export const GlossaryPage: React.FC = () => {
  const { documents, courses, videos } = useStudy();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const [allTerms, setAllTerms] = useState<GlossaryTerm[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  // Attribute glossary time to the course of the selected source, falling back to the
  // course filter when browsing all terms.
  const sourceCourseId = selectedSourceId
    ? (documents.find(d => d.id === selectedSourceId)?.courseId
      ?? videos.find(v => v.id === selectedSourceId)?.courseId
      ?? null)
    : null;
  useStudyTimer({ contextType: 'glossary', courseId: sourceCourseId ?? selectedCourseId });
  const [generateCourseId, setGenerateCourseId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [generatePage, setGeneratePage] = useState(1);
  const initialMastery = searchParams.get('mastery') === 'unmastered' ? 'unmastered' : 'all';
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>(initialMastery);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => masteredService.getCached(userId));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ term: '', definition: '' });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingMp3, setDownloadingMp3] = useState(false);

  const GENERATE_PAGE_SIZE = 6;

  const handleSelectCourse = (id: string | null) => {
    setSelectedCourseId(id);
    setSelectedSourceId('');
  };

  const handleSelectGenerateCourse = (id: string | null) => {
    setGenerateCourseId(id);
    setGeneratePage(1);
  };

  const toggleMastered = useCallback((id: string) => {
    // Optimistic update
    setMasteredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      masteredService.updateCache(userId, next);
      return next;
    });
    // Sync to server
    masteredService.toggle(userId, id).catch(() => {
      // Revert on failure
      setMasteredIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        masteredService.updateCache(userId, next);
        return next;
      });
    });
  }, [userId]);

  // Sync mastered IDs from server on mount
  useEffect(() => {
    if (userId === 'guest') return;
    masteredService.loadFromServer(userId).then(setMasteredIds).catch(() => { });
  }, [userId]);

  // `videos` (used only to label video-sourced glossary terms) comes from
  // StudyContext, which loads the lightweight list once and shares it.

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

  const filtered = useMemo(() => {
    let terms = allTerms;
    if (sourceType !== 'all') terms = terms.filter(t => t.sourceKind === sourceType);
    if (selectedSourceId) {
      terms = terms.filter(t =>
        t.documentId === selectedSourceId || t.youTubeVideoId === selectedSourceId
      );
    }
    if (selectedCourseId) terms = terms.filter(t => t.courseId === selectedCourseId);
    if (search.trim()) {
      const q = search.toLowerCase();
      terms = terms.filter(t => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q));
    }
    if (masteryFilter === 'mastered') terms = terms.filter(t => masteredIds.has(t.id));
    else if (masteryFilter === 'unmastered') terms = terms.filter(t => !masteredIds.has(t.id));
    return terms.sort((a, b) => a.term.localeCompare(b.term));
  }, [allTerms, sourceType, selectedSourceId, selectedCourseId, search, masteryFilter, masteredIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Prune selections that no longer match the active filters
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const visible = new Set(filtered.map(t => t.id));
      const next = new Set([...prev].filter(id => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  const allVisibleSelected = filtered.length > 0 && filtered.every(t => selectedIds.has(t.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const allSelected = filtered.length > 0 && filtered.every(t => prev.has(t.id));
      return allSelected ? new Set() : new Set(filtered.map(t => t.id));
    });
  }, [filtered]);

  // The terms that Play will read: the current selection, or the full filtered list when nothing is selected
  const playTerms = useMemo(
    () => (selectedIds.size > 0 ? filtered.filter(t => selectedIds.has(t.id)) : filtered),
    [filtered, selectedIds],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, GlossaryTerm[]>();
    for (const term of filtered) {
      const letter = term.term[0]?.toUpperCase() ?? '#';
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(term);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const availableLetters = useMemo(() => new Set(grouped.map(([l]) => l)), [grouped]);

  const scrollToLetter = (letter: string) => {
    document.getElementById(`glossary-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveLetter(letter);
  };

  // ttsItems derives from playTerms — selection (or, when empty, the filtered list) drives playback
  const ttsItems = useMemo(
    () => playTerms.map(t => ({ text: `${t.term}. ${t.definition}`, title: t.term })),
    [playTerms],
  );

  const getTtsSubtitle = useCallback(
    (index: number, itemCount: number) =>
      `Term ${index + 1} / ${itemCount}${masteryFilter !== 'all' ? ` · ${masteryFilter}` : ''}`,
    [masteryFilter],
  );

  const { playerState, play } = usePersistentTts('glossary', ttsItems, {
    getSubtitle: getTtsSubtitle,
  });

  const handleDownloadTxt = useCallback(() => {
    if (playTerms.length === 0) return;
    const text = playTerms.map(t => `${t.term}\n${t.definition}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedIds.size > 0 ? 'glossary_selected' : 'glossary'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [playTerms, selectedIds]);

  const handleDownloadMp3 = useCallback(async () => {
    if (playTerms.length === 0 || downloadingMp3) return;
    setDownloadingMp3(true);
    try {
      const text = playTerms.map(t => `${t.term}. ${t.definition}`).join('\n\n');
      const blob = await synthesizeToBlob(text);
      const name = selectedIds.size > 0 ? 'glossary_selected' : 'glossary';
      downloadAudioBlob(blob, name);
    } catch {
      // Surface nothing intrusive; synthesis errors are rare and retryable
    } finally {
      setDownloadingMp3(false);
    }
  }, [playTerms, selectedIds, downloadingMp3]);

  const masteredCount = useMemo(() => allTerms.filter(t => masteredIds.has(t.id)).length, [allTerms, masteredIds]);

  const counts = useMemo(() => ({
    all: allTerms.length,
    document: allTerms.filter(t => t.sourceKind === 'document').length,
    video: allTerms.filter(t => t.sourceKind === 'video').length,
    article: allTerms.filter(t => t.sourceKind === 'article').length,
    audio: allTerms.filter(t => t.sourceKind === 'audio').length,
  }), [allTerms]);

  const courseCounts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const term of allTerms) {
      if (!term.courseId) continue;
      next[term.courseId] = (next[term.courseId] ?? 0) + 1;
    }
    return next;
  }, [allTerms]);

  // Source options for filter dropdown (filtered by active kind tab)
  const sourceOptions = useMemo(() => {
    const options = new Map<string, string>();

    documents
      .filter(d => sourceType === 'all' || getDocKind(d) === sourceType)
      .forEach(d => options.set(d.id, getDocDisplayName(d)));

    if (sourceType === 'all' || sourceType === 'video') {
      videos.forEach(v => options.set(v.id, v.title));
    }

    allTerms
      .filter(t => sourceType === 'all' || t.sourceKind === sourceType)
      .forEach(t => {
        const id = t.documentId ?? t.youTubeVideoId;
        if (id && t.sourceName) options.set(id, t.sourceName);
      });

    return Array.from(options, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [documents, videos, allTerms, sourceType]);

  // All sources combined for the generate panel
  const allSources = useMemo(() => {
    const docs = documents.map(d => ({
      id: d.id,
      name: getDocDisplayName(d),
      kind: getDocKind(d) as 'document' | 'article' | 'audio',
      courseId: d.courseId,
      onGenerate: () => handleGenerateDoc(d.id),
    }));
    const vids = videos.map(v => ({
      id: v.id,
      name: v.title,
      kind: 'video' as const,
      courseId: v.courseId,
      onGenerate: () => handleGenerateVideo(v.id),
    }));
    return [...docs, ...vids];
  }, [documents, videos]);

  const generatedSourceIds = useMemo(() => {
    const ids = new Set<string>();
    allTerms.forEach(term => {
      if (term.documentId) ids.add(term.documentId);
      if (term.youTubeVideoId) ids.add(term.youTubeVideoId);
    });
    return ids;
  }, [allTerms]);

  const visibleSources = useMemo(() =>
    allSources.filter(s =>
      !generatedSourceIds.has(s.id) &&
      (!generateCourseId || s.courseId === generateCourseId)
    ),
    [allSources, generatedSourceIds, generateCourseId],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleSources.length / GENERATE_PAGE_SIZE));
    setGeneratePage(page => Math.min(page, totalPages));
  }, [visibleSources.length]);

  const kindIcon = (kind: string) => {
    if (kind === 'video') return <Youtube size={13} className="text-red-500 shrink-0" />;
    if (kind === 'article') return <Globe size={13} className="text-teal-500 shrink-0" />;
    if (kind === 'audio') return <Mic size={13} className="text-amber-500 shrink-0" />;
    return <FileText size={13} className="text-primary shrink-0" />;
  };

  const masteryTabs: { id: MasteryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unmastered', label: 'Learning' },
    { id: 'mastered', label: 'Mastered' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-text-main">
            Study <span className="text-primary">Glossary</span>
          </h1>
          <p className="text-zinc-500 font-medium">AI-extracted key terms and definitions from all your content.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-3xl font-black text-text-main">{allTerms.length}</p>
              <p className="text-xs text-text-muted font-medium">total terms</p>
            </div>
            {masteredCount > 0 && (
              <div className="text-right">
                <p className="text-3xl font-black text-emerald-600">{masteredCount}</p>
                <p className="text-xs text-emerald-500/70 font-medium">mastered</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <button
                onClick={() => setShareOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-4 py-2 text-xs font-bold text-text-muted hover:border-primary/50 hover:text-primary transition-all"
              >
                <Share2 size={13} />
                Share
              </button>
            )}
            {filtered.length > 0 && playerState === 'idle' && (
              <button
                onClick={() => play(0)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow hover:opacity-90 transition-opacity"
              >
                <Play size={13} className="fill-current" />
                {selectedIds.size > 0
                  ? `Play Selected (${playTerms.length})`
                  : `Play ${masteryFilter !== 'all' ? `(${filtered.length})` : 'All'}`}
              </button>
            )}
            {filtered.length > 0 && (
              <button
                onClick={handleDownloadTxt}
                title="Download as TXT"
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-4 py-2 text-xs font-bold text-text-muted hover:border-primary/50 hover:text-primary transition-all"
              >
                <Download size={13} />
                {`TXT${selectedIds.size > 0 ? ` (${playTerms.length})` : ''}`}
              </button>
            )}
            {filtered.length > 0 && (
              <button
                onClick={handleDownloadMp3}
                disabled={downloadingMp3}
                title="Download as MP3"
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-4 py-2 text-xs font-bold text-text-muted hover:border-primary/50 hover:text-primary transition-all disabled:opacity-50"
              >
                {downloadingMp3 ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {downloadingMp3
                  ? 'Generating…'
                  : `MP3${selectedIds.size > 0 ? ` (${playTerms.length})` : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Generate panel */}
      {allSources.length > 0 && (() => {
        const totalPages = Math.ceil(visibleSources.length / GENERATE_PAGE_SIZE);
        const pageSources = visibleSources.slice(
          (generatePage - 1) * GENERATE_PAGE_SIZE,
          generatePage * GENERATE_PAGE_SIZE,
        );
        return (
          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold text-text-main">Generate Glossary</h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {courses.length > 0 && (
                    <Select
                      value={generateCourseId ?? ''}
                      onChange={e => handleSelectGenerateCourse(e.target.value || null)}
                      size="xs"
                      selectClassName="py-2 font-semibold"
                      aria-label="Filter glossary generation by course"
                    >
                      <option value="">All Courses</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-3">
                  <span className="text-xs text-text-muted">
                    {(generatePage - 1) * GENERATE_PAGE_SIZE + 1}–{Math.min(generatePage * GENERATE_PAGE_SIZE, visibleSources.length)} of {visibleSources.length}
                  </span>
                  <Pagination
                    page={generatePage}
                    totalPages={totalPages}
                    onPageChange={setGeneratePage}
                    className="pt-0"
                    size="sm"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pageSources.length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] p-6 text-center text-sm font-medium text-text-muted">
                  No sources available for glossary generation.
                </div>
              ) : pageSources.map(src => {
                const isLoading = generating.has(src.id);
                return (
                  <div key={src.id} className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] p-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {kindIcon(src.kind)}
                      <p className="text-xs font-medium text-text-main truncate">{src.name}</p>
                    </div>
                    <button
                      onClick={src.onGenerate}
                      disabled={isLoading}
                      className={cn(
                        'ml-2 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all',
                        'bg-primary text-white hover:opacity-90'
                      )}
                    >
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {isLoading ? '...' : 'Generate'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Source type tabs + course pills */}
      <SourceFilterBar
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelectCourse={handleSelectCourse}
        sourceType={sourceType}
        onSelectType={t => { setSourceType(t); setSelectedSourceId(''); }}
        counts={counts}
        courseCounts={courseCounts}
        hideTypeTabs={true}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text" placeholder="Search terms..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Mastery filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">Status:</span>
          <div className="flex items-center gap-1">
            {masteryTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setMasteryFilter(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                  masteryFilter === tab.id
                    ? tab.id === 'mastered'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : tab.id === 'unmastered'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-zinc-800 text-white'
                    : 'border border-[var(--border-color)] text-text-muted hover:border-zinc-400',
                )}
              >
                {tab.id === 'mastered' && <CheckCircle2 size={12} />}
                {tab.id === 'unmastered' && <Circle size={12} />}
                {tab.label}
                {tab.id === 'mastered' && masteredCount > 0 && (
                  <span className="rounded-full bg-emerald-200 px-1.5 text-emerald-700">{masteredCount}</span>
                )}
                {tab.id === 'unmastered' && allTerms.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 text-amber-600">{allTerms.length - masteredCount}</span>
                )}
              </button>
            ))}
          </div>
          {masteryFilter !== 'all' && (
            <span className="text-xs text-text-muted ml-1">
              · {filtered.length} term{filtered.length !== 1 ? 's' : ''} shown
              {playerState !== 'idle' && ' · playing filtered list'}
            </span>
          )}
        </div>

        {/* Selection toolbar */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs font-bold text-primary hover:underline"
            >
              {allVisibleSelected ? 'Deselect all' : 'Select all'}
            </button>
            {selectedIds.size > 0 && (
              <span className="flex items-center gap-2 text-xs text-text-muted">
                {selectedIds.size} selected
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-2 py-0.5 font-bold text-text-muted hover:border-zinc-400"
                >
                  <X size={11} /> Clear
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Terms + A-Z nav */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-color)] py-20 text-center">
          <BookMarked size={40} className="mx-auto text-zinc-300 mb-3" />
          <p className="font-medium text-text-muted">
            {allTerms.length === 0
              ? 'Generate glossaries from your content to start.'
              : masteryFilter === 'mastered'
                ? 'No mastered terms yet. Mark terms as mastered to track your progress.'
                : masteryFilter === 'unmastered'
                  ? 'All terms are mastered!'
                  : 'No terms match your filter.'}
          </p>
          {allTerms.length === 0 && (
            <button
              onClick={() => navigate(documents.length > 0 ? '/library' : '/summarizer')}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            >
              {documents.length > 0 ? 'Go to Library' : 'Add Content'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 space-y-6">
            {grouped.map(([letter, terms]) => (
              <div key={letter} id={`glossary-${letter}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl font-black text-primary">{letter}</span>
                  <div className="flex-1 h-px bg-[var(--border-color)]" />
                  <span className="text-xs text-text-muted">{terms.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {terms.map(term => (
                    <GlossaryTermCard
                      key={term.id}
                      term={term}
                      isMastered={masteredIds.has(term.id)}
                      onToggleMastered={toggleMastered}
                      onEdit={startEdit}
                      onDelete={handleDelete}
                      isDeleting={deletingId === term.id}
                      isEditing={editingId === term.id}
                      editDraft={editingId === term.id ? editDraft : undefined}
                      onEditDraftChange={draft => setEditDraft(draft)}
                      isSaving={savingId === term.id}
                      onSave={saveEdit}
                      onCancelEdit={cancelEdit}
                      isSelected={selectedIds.has(term.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* A-Z letter nav */}
          <div className="hidden sm:flex sticky top-6 self-start flex-col items-center gap-px">
            {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ#').map(letter => {
              const has = availableLetters.has(letter);
              const isActive = activeLetter === letter;
              return (
                <button
                  key={letter}
                  onClick={() => has && scrollToLetter(letter)}
                  disabled={!has}
                  className={cn(
                    'w-6 h-6 rounded text-[11px] font-black flex items-center justify-center transition-all duration-150',
                    isActive
                      ? 'bg-primary text-white shadow-sm shadow-primary/30'
                      : has
                        ? 'text-primary hover:bg-primary/10'
                        : 'text-zinc-300 cursor-default',
                  )}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(() => {
        const shareDoc = selectedSourceId ? documents.find(d => d.id === selectedSourceId) : null;
        const shareVideo = selectedSourceId ? videos.find(v => v.id === selectedSourceId) : null;
        const isArticle = !!shareDoc?.originalUrl;
        const isAudio = shareDoc?.type === 'audio';
        const isPodcast = shareDoc?.type === 'podcast';
        const srcType: 'youtube' | 'article' | 'audio' | 'podcast' | 'document' | undefined =
          shareVideo ? 'youtube' : isArticle ? 'article' : isAudio ? 'audio' : isPodcast ? 'podcast' : shareDoc ? 'document' : undefined;
        const srcUrl = shareVideo
          ? (shareVideo.videoUrl ?? null)
          : shareDoc?.courseId ? `${shareDoc.courseId}/${shareDoc.id}` : null;
        return (
          <GlossaryShareModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            title={selectedSourceId
              ? (sourceOptions.find(s => s.id === selectedSourceId)?.name ?? 'Glossary')
              : 'Glossary'}
            terms={filtered}
            sourceType={srcType}
            sourceUrl={srcUrl}
            originalArticleUrl={isArticle ? (shareDoc?.originalUrl ?? null) : null}
          />
        );
      })()}
    </motion.div>
  );
};
