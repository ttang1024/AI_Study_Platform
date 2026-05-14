import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Library, Plus, GraduationCap,
} from 'lucide-react';
import { CONTENT_TYPE_ICONS } from '../constants/contentTypeIcons';
import { useStudy } from '../context/StudyContext';
import { youtubeService, VideoListItem } from '../services/youtubeService';
import { documentService } from '../services/documentService';
import { DocumentCard } from '../components/common/DocumentCard';
import { VideoCard } from '../components/common/VideoCard';
import { SearchFilterBar } from '../components/common/SearchFilterBar';
import { Pagination } from '../components/common/Pagination';
import { TypeFilterTabs, TypeTab } from '../components/common/TypeFilterTabs';
import { cn } from '../utils/cn';
import { Document } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'documents' | 'videos' | 'articles' | 'audio';

type LibraryItem =
  | { kind: 'document'; data: Document; sortDate: string }
  | { kind: 'video'; data: VideoListItem; sortDate: string };

const PAGE_SIZE = 8;

const TYPE_FILTERS: TypeTab<FilterType>[] = [
  { id: 'all',       label: 'All',       icon: Library },
  { id: 'documents', label: 'Documents', icon: CONTENT_TYPE_ICONS.document.icon },
  { id: 'videos',    label: 'Videos',    icon: CONTENT_TYPE_ICONS.video.icon },
  { id: 'articles',  label: 'Articles',  icon: CONTENT_TYPE_ICONS.article.icon },
  { id: 'audio',     label: 'Audio',     icon: CONTENT_TYPE_ICONS.audio.icon },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    isLoading, documents, videos, courses, totalDocuments, totalArticles, totalAudio,
    totalVideos, totalMaterials, courseMaterialCounts,
  } = useStudy();

  const [allVideos, setAllVideos] = useState<VideoListItem[]>(videos);
  const [libraryDocuments, setLibraryDocuments] = useState<Document[]>(documents);
  const [videosLoading, setVideosLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Sync type filter from URL param
  const activeType = (searchParams.get('type') as FilterType) || 'all';
  const setActiveType = (t: FilterType) => {
    setSearchParams(t === 'all' ? {} : { type: t }, { replace: true });
    setCurrentPage(1);
  };

  // Load the full library dataset for local filtering and pagination.
  useEffect(() => {
    let active = true;

    if (isLoading) {
      return () => { active = false; };
    }

    if (totalVideos <= videos.length) {
      setAllVideos(videos);
      setVideosLoading(false);
      return () => { active = false; };
    }

    setVideosLoading(true);
    youtubeService.getVideos({ page: 1, pageSize: Math.max(totalVideos, PAGE_SIZE) })
      .then(data => { if (active) setAllVideos(data.items); })
      .catch(() => { if (active) setAllVideos([]); })
      .finally(() => { if (active) setVideosLoading(false); });
    return () => { active = false; };
  }, [isLoading, totalVideos, videos]);

  useEffect(() => {
    let active = true;
    const totalDocumentItems = totalMaterials - totalVideos;

    if (isLoading) {
      return () => { active = false; };
    }

    if (totalDocumentItems <= documents.length) {
      setLibraryDocuments(documents);
      setDocumentsLoading(false);
      return () => { active = false; };
    }

    setDocumentsLoading(true);
    documentService.getAllDocuments(1, Math.max(totalDocumentItems, PAGE_SIZE))
      .then(data => { if (active) setLibraryDocuments(data.items); })
      .catch(() => { if (active) setLibraryDocuments(documents); })
      .finally(() => { if (active) setDocumentsLoading(false); });

    return () => { active = false; };
  }, [documents, isLoading, totalMaterials, totalVideos]);

  // Partition documents
  const audioDocs = useMemo(() => libraryDocuments.filter(d => d.type === 'audio' || d.type === 'podcast'), [libraryDocuments]);
  const regularDocs = useMemo(() => libraryDocuments.filter(d => d.type !== 'audio' && d.type !== 'podcast' && !d.originalUrl), [libraryDocuments]);
  const articleDocs = useMemo(() => libraryDocuments.filter(d => d.type !== 'audio' && d.type !== 'podcast' && !!d.originalUrl), [libraryDocuments]);

  // Build unified item list based on active type
  const allItems = useMemo((): LibraryItem[] => {
    const docItems = (
      activeType === 'videos' ? [] :
        activeType === 'audio' ? audioDocs :
          activeType === 'articles' ? articleDocs :
            activeType === 'documents' ? regularDocs :
              libraryDocuments
    ).map((d): LibraryItem => ({ kind: 'document', data: d, sortDate: d.uploadDate }));

    const videoItems = (activeType === 'documents' || activeType === 'articles' || activeType === 'audio' ? [] : allVideos)
      .map((v): LibraryItem => ({ kind: 'video', data: v, sortDate: v.createdAt }));

    return [...docItems, ...videoItems].sort(
      (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
    );
  }, [activeType, libraryDocuments, audioDocs, regularDocs, articleDocs, allVideos]);

  // Search + course filter
  const filteredItems = useMemo(() => allItems.filter(item => {
    const name = item.kind === 'document' ? item.data.name : item.data.title;
    const courseId = item.kind === 'document' ? item.data.courseId : item.data.courseId;
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseId === null || courseId === selectedCourseId;
    return matchesSearch && matchesCourse;
  }), [allItems, searchQuery, selectedCourseId]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginated = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

  const isEmpty = !videosLoading && filteredItems.length === 0;
  const isFiltered = !!searchQuery || selectedCourseId !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
          <Library size={22} />
        </div>
        <h1 className="text-3xl font-bold text-text-main">Library</h1>
        <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-sm">
          {totalByType[activeType]} Total
        </span>
      </div>
      {/* ── Type filter tabs ── */}
      <TypeFilterTabs
        tabs={TYPE_FILTERS.map(t => ({ ...t, count: totalByType[t.id] }))}
        active={activeType}
        onChange={setActiveType}
      />

      {/* ── Study course banner ── */}
      {selectedCourseId && (() => {
        const c = courses.find(x => x.id === selectedCourseId);
        const isEmpty = filteredItems.length === 0;
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
                onClick={() => navigate(`/summarizer?courseId=${c.id}`)}
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
      {(videosLoading && (activeType === 'all' || activeType === 'videos')) || (documentsLoading && activeType !== 'videos') ? (
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
                    ? 'Clip a web article from the AI Summarizer to get started.'
                    : activeType === 'audio'
                      ? 'Upload an audio lecture from the AI Summarizer to get started.'
                      : 'Upload a document from the AI Summarizer to get started.'}
            </p>
          </div>
          {!isFiltered && (
            <button
              onClick={() => navigate(activeType === 'videos' ? '/summarizer?tab=youtube' : activeType === 'audio' ? '/summarizer?tab=audio' : '/summarizer')}
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
            {paginated.map((item) => (
              <motion.div
                key={item.kind === 'document' ? `doc-${item.data.id}` : `vid-${item.data.id}`}
                layout
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              >
                {item.kind === 'document' ? (
                  <DocumentCard
                    doc={item.data}
                    course={getCourse(item.data.courseId)}
                    to={(item.data.type === 'audio' || item.data.type === 'podcast') ? `/audio/${item.data.id}` : item.data.originalUrl ? `/articles/${item.data.id}` : undefined}
                    onUpdated={(updated) => setLibraryDocuments(prev => prev.map(d => d.id === updated.id ? updated : d))}
                  />
                ) : (
                  <VideoCard
                    video={item.data}
                    to={`/youtube/${item.data.id}`}
                    onDeleted={() => setAllVideos(prev => prev.filter(v => v.id !== item.data.id))}
                    onMoved={(newCourseId) => setAllVideos(prev => prev.map(v => v.id === item.data.id ? { ...v, courseId: newCourseId } : v))}
                    onUpdated={(updated) => setAllVideos(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v))}
                  />
                )}
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* ── Pagination ── */}
      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </motion.div>
  );
};
