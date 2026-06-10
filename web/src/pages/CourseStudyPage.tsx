import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, FileType, FileCode, Mic, Youtube, FileVideo,
  ChevronLeft, ChevronRight, Loader2, Search, Menu, X, BookOpen, CheckCircle2, Circle, Filter,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { documentService } from '../services/documentService';
import { videoService, VideoListItem } from '../services/videoService';
import { courseService } from '../services/courseService';
import { glossaryService } from '../services/glossaryService';
import { noteService } from '../services/noteService';
import { workedProblemsService, WorkedProblem } from '../services/workedProblemsService';
import { questionBankService, QuestionBankQuestion } from '../services/questionBankService';
import { DocumentDetailsPage } from './DocumentDetailsPage';
import { VideoDetailPage } from './VideoDetailPage';
import { AudioDetailPage } from './AudioDetailPage';
import { ArticlePage } from './ArticlePage';
import { Document, Course, GlossaryTerm, Note } from '../types';
import { cn } from '../utils/cn';
import { CourseArtifacts, CourseArtifactsWorkspace, CourseStudySelected } from '../components/course/CourseArtifactsWorkspace';
import { useStudyTimer } from '../hooks/useStudyTimer';

// ─── Types ─────────────────────────────────────────────────────────────────

type Selected = CourseStudySelected;
type WorkspaceMode = 'study' | 'artifacts';

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseVideoId(url: string): string | null {
  const patterns = [/[?&]v=([^&]+)/, /youtu\.be\/([^?&/]+)/, /youtube\.com\/shorts\/([^?&/]+)/, /youtube\.com\/embed\/([^?&/]+)/];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function getVideoThumbSrc(video: VideoListItem) {
  const sourceType = video.sourceType ?? 'youtube';
  if (sourceType === 'bilibili') return video.thumbnailUrl || '/images/bilibili.png';
  if (sourceType === 'upload') return videoService.getUploadedVideoThumbnailUrl(video.id);
  const videoId = parseVideoId(video.videoUrl) ?? video.videoId;
  return video.thumbnailUrl || (videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '');
}

function getVideoThumbFallback(video: VideoListItem) {
  const sourceType = video.sourceType ?? 'youtube';
  if (sourceType === 'bilibili') return '/images/bilibili.png';
  if (sourceType === 'youtube') {
    const videoId = parseVideoId(video.videoUrl) ?? video.videoId;
    return videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : '';
  }
  return '';
}

const FILE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  pdf: { icon: FileText, label: 'PDF', color: 'text-red-400' },
  docx: { icon: FileText, label: 'DOCX', color: 'text-teal-500' },
  txt: { icon: FileType, label: 'TXT', color: 'text-zinc-400' },
  md: { icon: FileCode, label: 'MD', color: 'text-teal-400' },
  audio: { icon: Mic, label: 'Audio', color: 'text-green-400' },
  podcast: { icon: Mic, label: 'Podcast', color: 'text-purple-400' },
};

// ─── EmbeddedPage ─────────────────────────────────────────────────────────

const EmbeddedPage: React.FC<{ selected: Selected }> = ({ selected }) => {
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center px-6 h-full">
        <div className="rounded-2xl bg-[var(--primary)]/10 p-6">
          <BookOpen size={40} className="text-[var(--primary)]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-main">No material selected</h3>
          <p className="text-xs text-text-muted mt-1">Pick a document or video from the left panel</p>
        </div>
      </div>
    );
  }

  if (selected.kind === 'video') {
    return <VideoDetailPage key={selected.data.id} embedded id={selected.data.id} />;
  }

  const doc = selected.data;

  if (doc.type === 'audio' || doc.type === 'podcast') {
    return <AudioDetailPage key={doc.id} embedded id={doc.id} courseId={doc.courseId} />;
  }

  if (doc.originalUrl) {
    return <ArticlePage key={doc.id} embedded id={doc.id} courseId={doc.courseId} />;
  }

  return <DocumentDetailsPage key={doc.id} embedded id={doc.id} initialDoc={doc} />;
};

// ─── Component ─────────────────────────────────────────────────────────────

export const CourseStudyPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { courses, flashcards: contextFlashcards, totalNotes } = useStudy();
  useStudyTimer({ contextType: 'course', courseId, contextId: courseId, enabled: !!courseId });

  // Course + materials
  const [course, setCourse] = useState<Course | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [search, setSearch] = useState('');

  // Selection
  const [selected, setSelected] = useState<Selected>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('study');

  // Studied tracking (persisted per course in localStorage)
  const [studiedIds, setStudiedIds] = useState<Set<string>>(new Set());
  const [filterUnstudied, setFilterUnstudied] = useState(false);

  const [artifacts, setArtifacts] = useState<CourseArtifacts>({
    notes: [],
    flashcards: [],
    questions: [],
    glossary: [],
    workedProblems: [],
  });
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);

  // Load studied IDs from localStorage when courseId changes
  useEffect(() => {
    if (!courseId) return;
    const raw = localStorage.getItem(`studied_${courseId}`);
    setStudiedIds(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
  }, [courseId]);

  const toggleStudied = useCallback((id: string) => {
    setStudiedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (courseId) localStorage.setItem(`studied_${courseId}`, JSON.stringify([...next]));
      return next;
    });
  }, [courseId]);

  // Layout
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ─── Load course + materials ──────────────────────────────────────────────

  useEffect(() => {
    if (!courseId) return;
    const ctxCourse = courses.find(c => c.id === courseId);
    if (ctxCourse) setCourse(ctxCourse);
    else courseService.getCourse(courseId).then(setCourse).catch(() => { });

    setIsLoadingMaterials(true);
    Promise.all([
      documentService.getDocuments(courseId),
      videoService.getVideos({ courseId }),
    ]).then(([docs, vids]) => {
      setDocuments(docs);
      setVideos(vids.items);
      if (docs.length > 0) setSelected({ kind: 'doc', data: docs[0] });
      else if (vids.items.length > 0) setSelected({ kind: 'video', data: vids.items[0] });
    }).catch(() => { }).finally(() => setIsLoadingMaterials(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Bulk endpoints replace the old per-material fan-out: one notes page, one
  // course-scoped question-bank query and one glossary fetch cover every
  // document and video. Worked problems have no bulk endpoint yet, so they
  // remain per-material. Flashcards come straight from StudyContext (which
  // already holds the user's full deck) — see courseFlashcards below.
  useEffect(() => {
    if (!courseId || (documents.length === 0 && videos.length === 0)) {
      setArtifacts({ notes: [], flashcards: [], questions: [], glossary: [], workedProblems: [] });
      return;
    }

    let cancelled = false;
    const loadArtifacts = async () => {
      setIsLoadingArtifacts(true);
      try {
        const [notesPage, questions, glossary, docProblems, videoProblems] = await Promise.all([
          noteService.getAllNotes(1, Math.max(totalNotes, 50)).catch(() => ({ items: [] as Note[], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 })),
          questionBankService.getQuestions({ courseId }).catch(() => [] as QuestionBankQuestion[]),
          glossaryService.getAllGlossary().catch(() => [] as GlossaryTerm[]),
          Promise.all(documents.map(doc => workedProblemsService.getProblems(doc.id).catch(() => [] as WorkedProblem[]))),
          Promise.all(videos.map(video => workedProblemsService.getVideoProblems(video.id).catch(() => [] as WorkedProblem[]))),
        ]);

        if (cancelled) return;
        const documentIds = new Set(documents.map(d => d.id));
        const videoIds = new Set(videos.map(v => v.id));
        const inCourse = (docId?: string | null, videoId?: string | null) =>
          (!!docId && documentIds.has(docId)) || (!!videoId && videoIds.has(videoId));
        setArtifacts({
          notes: notesPage.items.filter(n => inCourse(n.documentId, n.youTubeVideoId)),
          flashcards: [],
          questions, // already course-scoped (and source-labeled) server-side
          glossary: glossary.filter(g =>
            inCourse(g.documentId, g.youTubeVideoId) || g.courseId === courseId,
          ),
          workedProblems: [...docProblems.flat(), ...videoProblems.flat()],
        });
      } finally {
        if (!cancelled) setIsLoadingArtifacts(false);
      }
    };

    void loadArtifacts();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, documents, videos]);

  // The full flashcard deck already lives in StudyContext; filtering it locally
  // avoids one request per material and keeps cards in sync as the deferred
  // context load resolves.
  const courseFlashcards = useMemo(() => {
    const documentIds = new Set(documents.map(d => d.id));
    const videoIds = new Set(videos.map(v => v.id));
    return contextFlashcards.filter(f =>
      (!!f.documentId && documentIds.has(f.documentId)) ||
      (!!f.youTubeVideoId && videoIds.has(f.youTubeVideoId)));
  }, [contextFlashcards, documents, videos]);

  const artifactsWithFlashcards = useMemo(
    () => ({ ...artifacts, flashcards: courseFlashcards }),
    [artifacts, courseFlashcards],
  );

  // ─── Derived values ──────────────────────────────────────────────────────

  const filteredDocs = useMemo(() => documents.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) &&
    (!filterUnstudied || !studiedIds.has(d.id))
  ), [documents, search, filterUnstudied, studiedIds]);

  const filteredVideos = useMemo(() => videos.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase()) &&
    (!filterUnstudied || !studiedIds.has(v.id))
  ), [videos, search, filterUnstudied, studiedIds]);
  const accent = course?.color || 'var(--primary)';
  const itemName = selected
    ? (selected.kind === 'doc' ? selected.data.name : selected.data.title)
    : '';

  // ─── Materials sidebar content ───────────────────────────────────────────

  const materialsList = (
    <div className="flex flex-col h-full">
      {/* Course header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-color)]" style={{ borderTop: `3px solid ${accent}` }}>
        <h2 className="text-sm font-bold text-text-main truncate">{course?.name ?? '…'}</h2>
        <p className="text-[11px] text-text-muted mt-0.5">
          {documents.length} doc{documents.length !== 1 ? 's' : ''} · {videos.length} video{videos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search + filter */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search materials…"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] pl-8 pr-3 py-1.5 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <button
            onClick={() => setFilterUnstudied(p => !p)}
            title={filterUnstudied ? 'Show all materials' : 'Show unread only'}
            className={cn(
              'shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border transition-colors',
              filterUnstudied
                ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                : 'border-[var(--border-color)] text-text-muted hover:text-text-main',
            )}
          >
            <Filter size={13} />
          </button>
        </div>
        {filterUnstudied && (
          <p className="mt-1 text-[10px] text-[var(--primary)]">Showing unread only</p>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-2">
        {isLoadingMaterials ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-[var(--primary)]" /></div>
        ) : filteredDocs.length === 0 && filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
            <BookOpen size={28} className="text-text-muted opacity-40" />
            <p className="text-xs text-text-muted">No materials found</p>
          </div>
        ) : (
          <>
            {filteredDocs.length > 0 && (
              <div>
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">Documents</p>
                {filteredDocs.map(doc => {
                  const meta = FILE_META[doc.type] ?? FILE_META.pdf;
                  const Icon = meta.icon;
                  const isActive = selected?.kind === 'doc' && selected.data.id === doc.id;
                  const isStudied = studiedIds.has(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        'flex items-center gap-1 pr-2 transition-all',
                        isActive ? 'bg-[var(--primary)]/10 border-r-2' : 'hover:bg-[var(--primary)]/5',
                      )}
                      style={isActive ? { borderColor: accent } : {}}
                    >
                      <button
                        onClick={() => { setSelected({ kind: 'doc', data: doc }); setSidebarOpen(false); }}
                        className="flex items-center gap-3 pl-4 py-2.5 text-left flex-1 min-w-0"
                      >
                        <div className={cn('shrink-0', meta.color, isActive && 'text-[var(--primary)]')}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-xs font-medium truncate', isActive ? 'text-[var(--primary)]' : 'text-text-main', isStudied && 'line-through opacity-60')}>{doc.name}</p>
                          <p className="text-[10px] text-text-muted">{meta.label}</p>
                        </div>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); toggleStudied(doc.id); }}
                        title={isStudied ? 'Mark as unread' : 'Mark as studied'}
                        className={cn('shrink-0 transition-colors', isStudied ? 'text-emerald-500' : 'text-text-muted hover:text-emerald-400')}
                      >
                        {isStudied ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredVideos.length > 0 && (
              <div className={filteredDocs.length > 0 ? 'mt-2' : ''}>
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">Videos</p>
                {filteredVideos.map(video => {
                  const isActive = selected?.kind === 'video' && selected.data.id === video.id;
                  const isStudied = studiedIds.has(video.id);
                  const sourceType = video.sourceType ?? 'youtube';
                  const isBilibili = sourceType === 'bilibili';
                  const isUpload = sourceType === 'upload';
                  const thumbSrc = getVideoThumbSrc(video);
                  const SourceIcon = isUpload ? FileVideo : Youtube;
                  const iconColor = isBilibili ? 'text-sky-400' : isUpload ? 'text-blue-400' : 'text-red-400';
                  const sourceLabel = isBilibili ? 'Bilibili' : isUpload ? 'Upload' : 'YouTube';
                  return (
                    <div
                      key={video.id}
                      className={cn(
                        'flex items-center gap-1 pr-2 transition-all',
                        isActive ? 'bg-[var(--primary)]/10 border-r-2' : 'hover:bg-[var(--primary)]/5',
                      )}
                      style={isActive ? { borderColor: accent } : {}}
                    >
                      <button
                        onClick={() => { setSelected({ kind: 'video', data: video }); setSidebarOpen(false); }}
                        className="flex items-center gap-3 pl-4 py-2.5 text-left flex-1 min-w-0"
                      >
                        {thumbSrc ? (
                          <>
                            <img
                              src={thumbSrc}
                              alt=""
                              className={cn('shrink-0 w-10 h-7 rounded object-cover', isStudied && 'opacity-50')}
                              referrerPolicy="no-referrer"
                              onError={e => {
                                const img = e.currentTarget as HTMLImageElement;
                                const fallback = getVideoThumbFallback(video);
                                if (fallback && img.dataset.fallbackUsed !== 'true') {
                                  img.dataset.fallbackUsed = 'true';
                                  img.src = fallback;
                                  return;
                                }
                                img.style.display = 'none';
                                (img.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                              }}
                            />
                            <div style={{ display: 'none' }} className={cn('shrink-0 items-center justify-center w-10 h-7 rounded bg-zinc-100', isActive ? 'text-[var(--primary)]' : iconColor)}>
                              {isBilibili ? (
                                <img src="/images/bilibili.png" alt="" className="h-4 w-4 object-contain" />
                              ) : (
                                <SourceIcon size={14} />
                              )}
                            </div>
                          </>
                        ) : (
                          <div className={cn('shrink-0 flex items-center justify-center w-10 h-7 rounded bg-zinc-100', isActive ? 'text-[var(--primary)]' : iconColor)}>
                            {isBilibili ? (
                              <img src="/images/bilibili.png" alt="" className="h-4 w-4 object-contain" />
                            ) : (
                              <SourceIcon size={14} />
                            )}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-xs font-medium line-clamp-2 leading-snug', isActive ? 'text-[var(--primary)]' : 'text-text-main', isStudied && 'line-through opacity-60')}>{video.title}</p>
                          <p className="text-[10px] text-text-muted">{sourceLabel}</p>
                        </div>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); toggleStudied(video.id); }}
                        title={isStudied ? 'Mark as unread' : 'Mark as studied'}
                        className={cn('shrink-0 transition-colors', isStudied ? 'text-emerald-500' : 'text-text-muted hover:text-emerald-400')}
                      >
                        {isStudied ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-[var(--bg-app)]">

      {/* ── Top bar ── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Mobile: toggle materials sidebar */}
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="flex xl:hidden items-center justify-center h-8 w-8 rounded-lg border border-[var(--border-color)] text-text-muted hover:text-text-main transition-colors"
          >
            {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
          </button>

          <div className="hidden xl:flex items-center gap-2">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <span className="text-sm font-semibold text-text-main">{course?.name ?? '…'}</span>
            {itemName && (
              <>
                <span className="text-text-muted">/</span>
                <span className="text-sm text-text-muted">{itemName}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-1">
          {(['study', 'artifacts'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setWorkspaceMode(mode)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors',
                workspaceMode === mode ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main',
              )}
            >
              {mode === 'study' ? 'Study' : 'Artifacts'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Materials sidebar — desktop fixed */}
        <div className={cn(
          'hidden xl:flex xl:shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] relative transition-all duration-200',
          sidebarCollapsed ? 'xl:w-10' : 'xl:w-64',
        )}>
          {!sidebarCollapsed && materialsList}

          {/* Collapse/expand toggle */}
          <button
            onClick={() => setSidebarCollapsed(p => !p)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-text-muted hover:text-text-main shadow-sm transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Materials sidebar — mobile overlay */}
        {sidebarOpen && (
          <div className="absolute inset-0 z-30 flex xl:hidden">
            <div className="w-72 flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] h-full shadow-2xl">
              {materialsList}
            </div>
            <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* Embedded detail page */}
        <div className="flex-1 overflow-hidden">
          {workspaceMode === 'study' ? (
            <EmbeddedPage selected={selected} />
          ) : (
            <CourseArtifactsWorkspace
              course={course}
              documents={documents}
              videos={videos}
              selected={selected}
              setSelected={(next) => {
                setSelected(next);
                setWorkspaceMode('study');
              }}
              artifacts={artifactsWithFlashcards}
              loading={isLoadingArtifacts}
            />
          )}
        </div>
      </div>
    </div>
  );
};
