import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check, Library, Plus, GraduationCap,
} from 'lucide-react';
import { CONTENT_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { useStudy } from '../../context/StudyContext';
import { libraryService, LibraryEntry } from '../../services/libraryService';
import { DocumentCard } from '../../components/common/DocumentCard';
import { VideoCard } from '../../components/common/VideoCard';
import { SearchFilterBar } from '../../components/common/SearchFilterBar';
import { Pagination } from '../../components/common/Pagination';
import { TypeFilterTabs, TypeTab } from '../../components/common/TypeFilterTabs';
import { LibraryTagBar } from '../../components/library/LibraryTagBar';
import { LibraryItemTags } from '../../components/library/LibraryItemTags';
import { LibrarySelectionBar } from '../../components/library/LibrarySelectionBar';
import type { AssignSelectionItem } from '../../components/library/LibraryAssignMenu';
import { cn } from '../../utils/cn';

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'documents' | 'videos' | 'articles' | 'audio';

const PAGE_SIZE = 8;

/** Stable identity for a row across refetches — documents and videos have separate id spaces. */
const entryKey = (entry: LibraryEntry) =>
  `${entry.kind === 'document' ? 'doc' : 'vid'}-${entry.data.id}`;

const toSelectionItem = (entry: LibraryEntry): AssignSelectionItem => ({
  ref: { itemKind: entry.kind, itemId: entry.data.id },
  tagIds: entry.tags.map(t => t.libraryTagId),
});

const TYPE_FILTERS: TypeTab<FilterType>[] = [
  { id: 'all', label: 'All', icon: Library },
  { id: 'documents', label: 'Documents', icon: CONTENT_TYPE_ICONS.document.icon },
  { id: 'videos', label: 'Videos', icon: CONTENT_TYPE_ICONS.video.icon },
  { id: 'articles', label: 'Articles', icon: CONTENT_TYPE_ICONS.article.icon },
  { id: 'audio', label: 'Audio', icon: CONTENT_TYPE_ICONS.audio.icon },
];

// ─── Page ────────────────────────────────────────────────────────────────────

/** The body of /library — everything already in the user's library. */
export const LibraryBrowse: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    courses, totalDocuments, totalArticles, totalAudio,
    totalVideos, totalMaterials, courseMaterialCounts, refreshStats,
  } = useStudy();

  const [items, setItems] = useState<LibraryEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Multi-selection for bulk tagging. Held as a map rather than a set of ids so a selection made
  // on page 1 survives paging to page 2 — the rows it refers to are no longer in `items`.
  const [selection, setSelection] = useState<Map<string, AssignSelectionItem>>(new Map());
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  // Bumped after a bulk change so the tag strip refetches its item counts.
  const [tagsReloadKey, setTagsReloadKey] = useState(0);

  // Sync type filter from URL param
  const activeType = (searchParams.get('type') as FilterType) || 'all';
  const setActiveType = (t: FilterType) => {
    // Merge rather than replace: the URL may also carry a search or course filter.
    const next = new URLSearchParams(searchParams);
    if (t === 'all') next.delete('type');
    else next.set('type', t);
    setSearchParams(next, { replace: true });
    setCurrentPage(1);
  };

  // Debounce the search box so we fire one request after typing settles, not one
  // per keystroke (search is now resolved server-side).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Fetch a single page from the unified library endpoint. Documents and videos
  // are merged, filtered, sorted and paginated server-side — we only ever hold
  // the current page in memory.
  const requestRef = React.useRef(0);
  const fetchPage = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const data = await libraryService.getLibrary({
        type: activeType,
        courseId: selectedCourseId,
        search: debouncedSearch,
        page: currentPage,
        pageSize: PAGE_SIZE,
        tagIds: selectedTagIds,
      });
      if (requestRef.current !== requestId) return; // a newer fetch superseded this one
      setItems(data.items);
      setTotalCount(data.totalCount);
      // Re-sync the tags of any selected row that is on this page, so the assign menu's
      // checkmarks reflect what the server just returned rather than pre-assign state.
      setSelection(prev => {
        if (prev.size === 0) return prev;
        const next = new Map(prev);
        for (const entry of data.items) {
          const key = entryKey(entry);
          if (next.has(key)) next.set(key, toSelectionItem(entry));
        }
        return next;
      });
    } catch {
      if (requestRef.current !== requestId) return;
      setItems([]);
      setTotalCount(0);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
    // selectedTagIds is joined rather than passed by reference: a new array of the same ids on
    // every render would re-run this effect forever.
  }, [activeType, selectedCourseId, debouncedSearch, currentPage, selectedTagIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const paginated = items;

  // A card removed itself server-side. Refresh the type/course badges (from stats)
  // and either step back a page if we just emptied the last one, or refill this page.
  const handleDeleted = useCallback(() => {
    refreshStats();
    if (items.length <= 1 && currentPage > 1) {
      setCurrentPage(p => p - 1); // triggers a refetch via fetchPage's deps
    } else {
      fetchPage();
    }
  }, [refreshStats, items.length, currentPage, fetchPage]);

  // ── Multi-selection ───────────────────────────────────────────────────────

  const toggleSelected = useCallback((entry: LibraryEntry) => {
    setBulkStatus(null);
    setSelection(prev => {
      const next = new Map(prev);
      const key = entryKey(entry);
      if (next.has(key)) next.delete(key);
      else next.set(key, toSelectionItem(entry));
      return next;
    });
  }, []);

  const selectPage = useCallback(() => {
    setBulkStatus(null);
    setSelection(prev => {
      const next = new Map(prev);
      for (const entry of items) next.set(entryKey(entry), toSelectionItem(entry));
      return next;
    });
  }, [items]);

  // A bulk assign changed server state: refresh the rows (their chips) and the strip's counts.
  const handleBulkChanged = useCallback((message: string) => {
    setBulkStatus(message);
    setTagsReloadKey(k => k + 1);
    fetchPage();
  }, [fetchPage]);

  // Counts per type (for the header badge)
  const totalByType: Record<FilterType, number> = {
    all: totalMaterials,
    documents: totalDocuments,
    videos: totalVideos,
    articles: totalArticles,
    audio: totalAudio,
  };

  // Course counts for SearchFilterBar (combined across active type)
  const courseCounts = useMemo(() => {
    return Object.fromEntries(
      courses.map(c => {
        const stats = courseMaterialCounts.find(s => s.courseId === c.id);
        const count =
          activeType === 'documents' ? (stats?.documents ?? 0) :
            activeType === 'articles' ? (stats?.articles ?? 0) :
              activeType === 'audio' ? (stats?.audio ?? 0) :
                activeType === 'videos' ? (stats?.videos ?? 0) :
                  (stats?.total ?? 0);
        return [c.id, count];
      })
    );
  }, [activeType, courseMaterialCounts, courses]);

  const getCourse = (id?: string) => courses.find(c => c.id === id);

  // ── Empty state helpers ───────────────────────────────────────────────────

  const isEmpty = !loading && totalCount === 0;
  const isFiltered = !!searchQuery || selectedCourseId !== null || selectedTagIds.length > 0;
  const hasSelection = selection.size > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* ── Type filter tabs ── */}
      <TypeFilterTabs
        tabs={TYPE_FILTERS.map(t => ({ ...t, count: totalByType[t.id] }))}
        active={activeType}
        onChange={setActiveType}
      />

      {/* ── Study course banner ── */}
      {selectedCourseId && (() => {
        const c = courses.find(x => x.id === selectedCourseId);
        const isEmpty = !loading && totalCount === 0;
        return c ? (
          <div
            className="flex items-center justify-between rounded-2xl border px-4 py-3 gap-3"
            style={{ borderColor: `${c.color}40`, backgroundColor: `${c.color}0c` }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                <GraduationCap size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-text-main truncate">{c.name}</p>
                <p className="text-[11px] text-text-muted">{isEmpty ? 'No content yet' : 'Filtered to this course'}</p>
              </div>
            </div>
            {isEmpty ? (
              <button
                onClick={() => navigate(`/library/add?courseId=${c.id}`)}
                className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: c.color }}
              >
                <Plus size={12} />
                Add Content
              </button>
            ) : (
              <a
                href={`/courses/${c.id}/study`}
                className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: c.color }}
              >
                <GraduationCap size={12} />
                Study Course
              </a>
            )}
          </div>
        ) : null;
      })()}

      {/* ── Collections, tags, saved views ── */}
      <LibraryTagBar
        selectedTagIds={selectedTagIds}
        onChange={ids => { setSelectedTagIds(ids); setCurrentPage(1); }}
        onApplyView={filters => {
          // A saved view restores the whole filter set, not just its tags — that is what makes it
          // a view rather than a tag shortcut.
          setSelectedTagIds(filters.tagIds ?? []);
          setSelectedCourseId(filters.courseId ?? null);
          setSearchQuery(filters.search ?? '');
          if (filters.type) setActiveType(filters.type as FilterType);
          setCurrentPage(1);
        }}
        currentFilters={{
          type: activeType,
          courseId: selectedCourseId,
          search: debouncedSearch || null,
          tagIds: selectedTagIds,
        }}
        reloadSignal={tagsReloadKey}
      />

      {/* ── Search & Course filter ── */}
      <SearchFilterBar
        searchValue={searchQuery}
        onSearchChange={v => { setSearchQuery(v); setCurrentPage(1); }}
        placeholder={activeType === 'videos' ? 'Search by title…' : 'Search by name…'}
        courses={courses}
        selectedCourseId={selectedCourseId}
        onCourseChange={id => { setSelectedCourseId(id); setCurrentPage(1); }}
        allCount={totalByType[activeType]}
        courseCounts={courseCounts}
      />

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden animate-pulse">
              <div className="aspect-video bg-zinc-200" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-zinc-200 rounded w-3/4" />
                <div className="h-3 bg-zinc-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] py-20 text-center bg-[var(--bg-sidebar)] gap-5">
          <div className={cn(
            'flex h-16 w-16 items-center justify-center rounded-2xl',
            activeType === 'videos' ? 'bg-red-500/10 text-red-500' : activeType === 'audio' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary',
          )}>
            {activeType === 'videos' ? <CONTENT_TYPE_ICONS.video.icon size={32} /> : activeType === 'articles' ? <CONTENT_TYPE_ICONS.article.icon size={32} /> : activeType === 'audio' ? <CONTENT_TYPE_ICONS.audio.icon size={32} /> : <CONTENT_TYPE_ICONS.document.icon size={32} />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-main">
              {isFiltered ? 'No results found' : `No ${activeType === 'all' ? 'items' : activeType} yet`}
            </h3>
            <p className="text-sm text-text-muted mt-1 max-w-xs mx-auto">
              {isFiltered
                ? 'Try adjusting your search or course filter.'
                : activeType === 'videos'
                  ? 'Analyze your first YouTube video to get started.'
                  : activeType === 'articles'
                    ? 'Clip a web article from the Add Content page to get started.'
                    : activeType === 'audio'
                      ? 'Upload an audio lecture from the Add Content page to get started.'
                      : 'Upload a document from the Add Content page to get started.'}
            </p>
          </div>
          {!isFiltered && (
            <button
              onClick={() => navigate(activeType === 'videos' ? '/library/add?tab=link' : activeType === 'audio' ? '/library/add?tab=audio' : '/library/add')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors',
                activeType === 'videos' ? 'bg-red-500 hover:bg-red-600' : activeType === 'audio' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:opacity-90',
              )}
            >
              <Plus size={15} />
              {activeType === 'videos' ? 'Analyze a Video' : activeType === 'audio' ? 'Upload Audio' : 'Add Content'}
            </button>
          )}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {paginated.map((item) => {
              const key = entryKey(item);
              const isSelected = selection.has(key);
              return (
              <motion.div
                key={key}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className="group/sel relative"
                // While a selection is active the whole card toggles instead of navigating —
                // capture phase, because the card's own <Link> would otherwise win.
                onClickCapture={hasSelection ? (e => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSelected(item);
                }) : undefined}
              >
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); toggleSelected(item); }}
                  aria-pressed={isSelected}
                  aria-label={isSelected ? 'Deselect item' : 'Select item'}
                  className={cn(
                    'absolute -left-2 -top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-opacity',
                    isSelected
                      ? 'border-transparent bg-[var(--primary)] text-white opacity-100'
                      : 'border-[var(--border-color)] bg-white text-transparent opacity-0 group-hover/sel:opacity-100',
                    hasSelection && 'opacity-100',
                  )}
                >
                  <Check size={13} />
                </button>

                {item.kind === 'document' ? (
                  <DocumentCard
                    doc={item.data}
                    course={getCourse(item.data.courseId)}
                    to={(item.data.type === 'audio' || item.data.type === 'podcast') ? `/audio/${item.data.id}` : item.data.originalUrl ? `/articles/${item.data.id}` : undefined}
                    onDeleted={() => handleDeleted()}
                    onUpdated={(updated) => setItems(prev => prev.map(it => it.kind === 'document' && it.data.id === updated.id ? { kind: 'document', data: updated, tags: it.tags } : it))}
                  />
                ) : (
                  <VideoCard
                    video={item.data}
                    to={`/videos/${item.data.id}`}
                    onDeleted={() => handleDeleted()}
                    onMoved={(newCourseId) => setItems(prev => prev.map(it => it.kind === 'video' && it.data.id === item.data.id ? { kind: 'video', data: { ...it.data, courseId: newCourseId }, tags: it.tags } : it))}
                    onUpdated={(updated) => setItems(prev => prev.map(it => it.kind === 'video' && it.data.id === updated.id ? { kind: 'video', data: { ...it.data, ...updated }, tags: it.tags } : it))}
                  />
                )}

                <LibraryItemTags
                  itemRef={{ itemKind: item.kind, itemId: item.data.id }}
                  tags={item.tags}
                  onRemoved={() => { setTagsReloadKey(k => k + 1); fetchPage(); }}
                />
              </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* ── Pagination ── */}
      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Clears the floating selection bar so the pagination stays clickable. */}
      {hasSelection && <div className="h-14" aria-hidden />}

      {/* ── Bulk tagging bar (only while something is selected) ── */}
      <LibrarySelectionBar
        selection={[...selection.values()]}
        onSelectAll={selectPage}
        onClear={() => { setSelection(new Map()); setBulkStatus(null); }}
        onChanged={handleBulkChanged}
        status={bulkStatus}
      />
    </motion.div>
  );
};
