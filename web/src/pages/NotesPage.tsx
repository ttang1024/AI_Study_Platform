import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Calendar, Trash2, Edit3, X, Check, Loader2, Sparkles, Play, Share2, Download } from 'lucide-react';
import { STUDY_TYPE_ICONS } from '../constants/contentTypeIcons';
import { CONTENT_TYPE_ICONS } from '../constants/contentTypeIcons';
import { useStudy } from '../context/StudyContext';
import { cn } from '../utils/cn';
import { getDocDisplayName } from '../utils/docName';
import { Button } from '../components/common/Button';
import { RichTextEditor } from '../components/common/RichTextEditor';
import { videoService, VideoListItem } from '../services/videoService';
import { noteService } from '../services/noteService';
import { Note } from '../types';
import { SourceFilterBar, SourceType } from '../components/common/SourceFilterBar';
import { usePersistentTts } from '../context/TtsContext';
import { ShareModal } from '../components/common/ShareModal';
import { Pagination } from '../components/common/Pagination';
import { downloadNotesMarkdown, ExportNoteRecord } from '../services/exportInteropService';

const PAGE_SIZE = 5;

const stripHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

interface VideoNoteEntry {
  noteId: string;
  videoRecordId: string;
  title: string;
  courseId: string;
  courseColor: string;
  courseName: string;
  content: string;
  createdAt: string;
}

type UnifiedNoteItem =
  | { type: 'doc' | 'article' | 'audio'; note: Note; docName: string; courseId: string; courseName: string; courseColor: string; docId?: string }
  | { type: 'video'; entry: VideoNoteEntry };

interface NoteCardProps {
  title: string;
  courseName: string;
  courseColor: string;
  createdAt: string;
  content: string;
  icon: React.ReactNode;
  viewLabel: string;
  onView?: () => void;
  onShare?: () => void;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({
  title, courseName, courseColor, createdAt, content, icon, viewLabel, onView, onShare,
  isEditing, editContent, onEditContentChange, onStartEdit, onSave, onCancel, onDelete,
}) => (
  <div className="bg-[var(--bg-sidebar)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
    <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-zinc-50/50">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <h3 className="font-bold text-text-main truncate">{title}</h3>
        {courseName && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: courseColor }}>{courseName}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {onShare && (
          <button onClick={onShare} className="p-1.5 text-text-muted hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-all" title="Share note">
            <Share2 size={14} />
          </button>
        )}
        {onView && (
          <button onClick={onView} className="text-xs font-medium text-[var(--primary)] hover:underline flex items-center gap-1">
            {viewLabel} <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
    <div className={cn('p-6 group relative', isEditing ? 'bg-[var(--primary)]/5' : 'hover:bg-zinc-50/30')}>
      {isEditing ? (
        <div className="space-y-4">
          <RichTextEditor content={editContent} onChange={onEditContentChange} placeholder="Edit your note..." />
          <div className="flex gap-2 justify-end">
            <Button onClick={onCancel} variant="outline" size="sm"><X size={14} className="mr-1" />Cancel</Button>
            <Button onClick={onSave} size="sm"><Check size={14} className="mr-1" />Save</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start mb-2">
            <span className="flex items-center gap-1 text-[10px] text-text-muted uppercase tracking-wider font-bold">
              <Calendar size={12} />{new Date(createdAt).toLocaleDateString()}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={onStartEdit} className="p-1.5 text-text-muted hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-all"><Edit3 size={14} /></button>
              <button onClick={onDelete} className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="text-sm text-text-main leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
        </>
      )}
    </div>
  </div>
);

export const NotesPage: React.FC = () => {
  const navigate = useNavigate();
  const { documents, courses, allNotes, isLoading: contextLoading, deleteNote, updateNote, refreshNotes } = useStudy();

  useEffect(() => { refreshNotes(); }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const [videoNotes, setVideoNotes] = useState<VideoNoteEntry[]>([]);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editVideoContent, setEditVideoContent] = useState('');
  const [videoList, setVideoList] = useState<VideoListItem[]>([]);

  const [sourceType, setSourceType] = useState<SourceType>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [shareNote, setShareNote] = useState<{
    title: string;
    notesHtml: string;
    sourceType?: 'youtube' | 'article' | 'audio' | 'podcast' | 'document';
    sourceUrl?: string | null;
    originalArticleUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    videoService.getVideos({ page: 1 })
      .then(data => setVideoList(data.items))
      .catch(() => { });
  }, []);

  useEffect(() => {
    const entries: VideoNoteEntry[] = allNotes
      .filter(n => n.youTubeVideoId)
      .map(n => {
        const video = videoList.find(v => v.id === n.youTubeVideoId);
        return {
          noteId: n.id,
          videoRecordId: n.youTubeVideoId!,
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
    const docOnly = allNotes.filter(n => !n.youTubeVideoId);
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

  useEffect(() => { setPage(1); }, [sourceType, selectedCourseId, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const ttsItems = useMemo(
    () => filteredItems.map((item, i) => {
      const title = item.type !== 'video' ? item.docName : item.entry.title;
      const content = item.type !== 'video' ? item.note.content : item.entry.content;
      return { text: `Note ${i + 1}: ${title}. ${stripHtml(content)}`, title };
    }),
    [filteredItems],
  );

  const getTtsSubtitle = useCallback(
    (index: number, itemCount: number) => `Note ${index + 1} / ${itemCount}`,
    [],
  );

  const { playerState, play } = usePersistentTts('notes', ttsItems, {
    getSubtitle: getTtsSubtitle,
  });

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

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await updateNote(editingId, editContent);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteNote(id);
  };

  const handleSaveEditVideo = (noteId: string) => {
    noteService.updateNote(noteId, { content: editVideoContent }).catch(() => { });
    setVideoNotes(prev => prev.map(v => v.noteId === noteId ? { ...v, content: editVideoContent } : v));
    setEditingVideoId(null);
  };

  const handleDeleteVideo = (noteId: string) => {
    noteService.deleteNote(noteId).catch(() => { });
    setVideoNotes(prev => prev.filter(v => v.noteId !== noteId));
  };

  const exportableNotes = useMemo<ExportNoteRecord[]>(() => filteredItems.map(item => {
    if (item.type === 'video') {
      return {
        title: item.entry.title,
        courseName: item.entry.courseName,
        sourceType: 'video',
        createdAt: item.entry.createdAt,
        html: item.entry.content,
      };
    }

    return {
      title: item.docName,
      courseName: item.courseName,
      sourceType: item.type,
      createdAt: item.note.createdAt,
      html: item.note.content,
    };
  }), [filteredItems]);

  const resolveVideoUrl = React.useCallback(async (videoRecordId: string): Promise<string | null> => {
    const cachedVideo = videoList.find(v => v.id === videoRecordId);
    if (cachedVideo?.videoUrl) return cachedVideo.videoUrl;

    try {
      const video = await videoService.getVideo(videoRecordId);
      return video.videoUrl ?? null;
    } catch {
      return null;
    }
  }, [videoList]);

  const isEmpty = !contextLoading && filteredItems.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-black tracking-tight text-text-main">
            Study <span className="text-primary">Notes</span>
          </h1>
          <p className="text-lg text-zinc-500 font-medium max-w-2xl">
            Capture your thoughts across every document &amp; lecture.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredItems.length > 0 && playerState === 'idle' && (
            <Button
              onClick={() => play(0)}
              size="sm"
              className="flex items-center gap-1.5 shrink-0"
            >
              <Play size={14} className="fill-current" />
              Play Notes
            </Button>
          )}
          {exportableNotes.length > 0 && (
            <Button
              onClick={() => downloadNotesMarkdown(exportableNotes, 'filtered_notes')}
              size="sm"
              variant="outline"
              className="flex items-center gap-1.5 shrink-0"
            >
              <Download size={14} />
              Export MD
            </Button>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--primary)] transition-all"
            />
          </div>
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
        courseCounts={courseCounts}
        hideTypeTabs={true}
      />

      {contextLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-[var(--bg-sidebar)] rounded-3xl border border-dashed border-[var(--border-color)]">
          <div className="h-16 w-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] mb-4">
            <STUDY_TYPE_ICONS.notes.icon size={32} />
          </div>
          <h3 className="text-lg font-bold text-text-main">No notes found</h3>
          <p className="text-sm text-text-muted max-w-xs mt-2">Start taking notes while studying your documents to see them here.</p>
          {allItems.length === 0 && (
            <button
              onClick={() => navigate(documents.length > 0 ? '/library' : '/summarizer')}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
            >
              {documents.length > 0 ? 'Go to Library' : 'Add Content'}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            {pagedItems.map(item => {
              if (item.type !== 'video') {
                const { type, note, docName, courseColor, courseName, docId } = item;
                const icon = type === 'article'
                  ? <CONTENT_TYPE_ICONS.article.icon  size={18} className="text-teal-500 shrink-0" />
                  : type === 'audio'
                    ? <CONTENT_TYPE_ICONS.audio.icon   size={18} className="text-amber-500 shrink-0" />
                    : <CONTENT_TYPE_ICONS.document.icon size={18} className="text-[var(--primary)] shrink-0" />;
                const viewLabel = type === 'article' ? 'View Article' : type === 'audio' ? 'View Audio' : 'View Document';
                const viewPath = type === 'audio' ? `/audio/${docId}` : type === 'article' ? `/articles/${docId}` : `/documents/${docId}`;
                return (
                  <NoteCard
                    key={note.id}
                    title={docName}
                    courseName={courseName}
                    courseColor={courseColor}
                    createdAt={note.createdAt}
                    content={note.content}
                    icon={icon}
                    viewLabel={viewLabel}
                    onView={docId ? () => navigate(viewPath) : undefined}
                    onShare={() => {
                      const doc = documents.find(d => d.id === docId);
                      const isArticle = !!doc?.originalUrl;
                      const isAudio = doc?.type === 'audio';
                      const isPodcast = doc?.type === 'podcast';
                      const srcType = isArticle ? 'article' : isAudio ? 'audio' : isPodcast ? 'podcast' : 'document';
                      setShareNote({
                        title: docName,
                        notesHtml: note.content,
                        sourceType: srcType,
                        sourceUrl: doc?.courseId ? `${doc.courseId}/${doc.id}` : null,
                        originalArticleUrl: isArticle ? (doc?.originalUrl ?? null) : null,
                      });
                    }}
                    isEditing={editingId === note.id}
                    editContent={editContent}
                    onEditContentChange={setEditContent}
                    onStartEdit={() => { setEditingId(note.id); setEditContent(note.content); }}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingId(null)}
                    onDelete={() => handleDelete(note.id)}
                  />
                );
              } else {
                const { entry } = item;
                return (
                  <NoteCard
                    key={entry.noteId}
                    title={entry.title}
                    courseName={entry.courseName}
                    courseColor={entry.courseColor}
                    createdAt={entry.createdAt}
                    content={entry.content}
                    icon={<CONTENT_TYPE_ICONS.video.icon size={18} className="text-red-500 shrink-0" />}
                    viewLabel="View Video"
                    onView={() => navigate(`/videos/${entry.videoRecordId}`)}
                    onShare={async () => {
                      const video = videoList.find(v => v.id === entry.videoRecordId);
                      const sourceUrl = video?.videoUrl ?? await resolveVideoUrl(entry.videoRecordId);
                      setShareNote({
                        title: entry.title,
                        notesHtml: entry.content,
                        sourceType: 'youtube',
                        sourceUrl,
                      });
                    }}
                    isEditing={editingVideoId === entry.noteId}
                    editContent={editVideoContent}
                    onEditContentChange={setEditVideoContent}
                    onStartEdit={() => { setEditingVideoId(entry.noteId); setEditVideoContent(entry.content); }}
                    onSave={() => handleSaveEditVideo(entry.noteId)}
                    onCancel={() => setEditingVideoId(null)}
                    onDelete={() => handleDeleteVideo(entry.noteId)}
                  />
                );
              }
            })}
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {shareNote && (
        <ShareModal
          open={!!shareNote}
          onClose={() => setShareNote(null)}
          title={shareNote.title}
          notesHtml={shareNote.notesHtml}
          sourceType={shareNote.sourceType}
          sourceUrl={shareNote.sourceUrl}
          originalArticleUrl={shareNote.originalArticleUrl}
        />
      )}

    </div>
  );
};
