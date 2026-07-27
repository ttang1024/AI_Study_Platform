import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStudy } from '../../context/StudyContext';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { BookMarked, Search, X } from 'lucide-react';
import { GlossaryTerm } from '../../types';
import { getDocDisplayName } from '../../utils/docName';
import { SourceFilterBar, SourceType } from '../../components/common/SourceFilterBar';
import { GlossaryShareModal } from '../../components/common/GlossaryShareModal';
import { GlossaryTermCard } from '../../components/common/GlossaryTermCard';
import { GlossaryGeneratePanel } from '../../components/glossary/GlossaryGeneratePanel';
import { GlossaryHeader } from '../../components/glossary/GlossaryHeader';
import { GlossaryMasteryFilter, MasteryFilter } from '../../components/glossary/GlossaryMasteryFilter';
import { GlossaryLetterNav } from '../../components/glossary/GlossaryLetterNav';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { useGlossaryAudio } from '../../hooks/useGlossaryAudio';
import { useGlossaryTerms, getDocKind } from '../../hooks/useGlossaryTerms';
import { useMasteredTerms } from '../../hooks/useMasteredTerms';

/** The Glossary half of /materials. The old /glossary route redirects to ?tab=glossary. */
export const GlossaryTab: React.FC = () => {
  const { documents, courses, videos, ensureDocuments, ensureVideos } = useStudy();
  // The document and video lists (used to label glossary sources) load lazily.
  useEffect(() => { void ensureDocuments(); void ensureVideos(); }, [ensureDocuments, ensureVideos]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';

  const {
    allTerms,
    generating, handleGenerateDoc, handleGenerateVideo,
    editingId, editDraft, setEditDraft, savingId, deletingId,
    startEdit, cancelEdit, saveEdit, handleDelete,
  } = useGlossaryTerms(userId, documents, videos);
  const { masteredIds, toggleMastered } = useMasteredTerms(userId);

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
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [generatePage, setGeneratePage] = useState(1);
  const initialMastery = searchParams.get('mastery') === 'unmastered' ? 'unmastered' : 'all';
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>(initialMastery);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const GENERATE_PAGE_SIZE = 6;

  const handleSelectCourse = (id: string | null) => {
    setSelectedCourseId(id);
    setSelectedSourceId('');
  };

  const handleSelectGenerateCourse = (id: string | null) => {
    setGenerateCourseId(id);
    setGeneratePage(1);
  };

  const filtered = useMemo(() => {
    let terms = allTerms;
    if (sourceType !== 'all') terms = terms.filter(t => t.sourceKind === sourceType);
    if (selectedSourceId) {
      terms = terms.filter(t =>
        t.documentId === selectedSourceId || t.videoId === selectedSourceId
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

  const { playerState, play, downloadingMp3, handleDownloadTxt, handleDownloadMp3 } =
    useGlossaryAudio(playTerms, selectedIds, masteryFilter);

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
        const id = t.documentId ?? t.videoId;
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
      if (term.videoId) ids.add(term.videoId);
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <GlossaryHeader
        totalTerms={allTerms.length}
        masteredCount={masteredCount}
        filteredCount={filtered.length}
        selectedCount={selectedIds.size}
        playCount={playTerms.length}
        masteryFilter={masteryFilter}
        playerIdle={playerState === 'idle'}
        downloadingMp3={downloadingMp3}
        onShare={() => setShareOpen(true)}
        onPlay={() => play(0)}
        onDownloadTxt={handleDownloadTxt}
        onDownloadMp3={handleDownloadMp3}
      />

      {/* Generate panel */}
      {allSources.length > 0 && (
        <GlossaryGeneratePanel
          sources={visibleSources}
          page={generatePage}
          pageSize={GENERATE_PAGE_SIZE}
          onPageChange={setGeneratePage}
          courses={courses}
          generateCourseId={generateCourseId}
          onSelectCourse={handleSelectGenerateCourse}
          generating={generating}
        />
      )}

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

        <GlossaryMasteryFilter
          value={masteryFilter}
          onChange={setMasteryFilter}
          totalCount={allTerms.length}
          masteredCount={masteredCount}
          filteredCount={filtered.length}
          playing={playerState !== 'idle'}
        />

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
              onClick={() => navigate(documents.length > 0 ? '/library' : '/library?view=add')}
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

          <GlossaryLetterNav
            availableLetters={availableLetters}
            activeLetter={activeLetter}
            onSelect={scrollToLetter}
          />
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
