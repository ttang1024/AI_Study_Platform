import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Play, Download } from 'lucide-react';
import { STUDY_TYPE_ICONS } from '../constants/contentTypeIcons';
import { CONTENT_TYPE_ICONS } from '../constants/contentTypeIcons';
import { useStudy } from '../context/StudyContext';
import { Button } from '../components/common/Button';
import { videoService } from '../services/videoService';
import { noteService } from '../services/noteService';
import { SourceFilterBar, SourceType } from '../components/common/SourceFilterBar';
import { ShareModal } from '../components/common/ShareModal';
import { Pagination } from '../components/common/Pagination';
import { downloadNotesMarkdown, ExportNoteRecord } from '../services/exportInteropService';
import { NoteCard } from '../components/notes/NoteCard';
import { useNotesData } from '../hooks/useNotesData';
import { useNotesAudio } from '../hooks/useNotesAudio';

const PAGE_SIZE = 5;

export const NotesPage: React.FC = () => {
  const navigate = useNavigate();
  const { documents, courses, allNotes, isLoading: contextLoading, deleteNote, updateNote, refreshNotes, videos: videoList, ensureDocuments, ensureVideos } = useStudy();

  useEffect(() => { refreshNotes(); }, []);
  // The document and video lists (used to label note sources) load lazily.
  useEffect(() => { void ensureDocuments(); void ensureVideos(); }, [ensureDocuments, ensureVideos]);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editVideoContent, setEditVideoContent] = useState('');

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

  // `videoList` (used to resolve each video-sourced note's title/course) comes
  // from StudyContext, which loads the lightweight list once and shares it.
  const {
    setVideoNotes,
    allItems, filteredItems, counts, courseCounts,
    selectedIds, setSelectedIds, toggleSelect, toggleSelectAll, allVisibleSelected,
  } = useNotesData({ allNotes, videoList, documents, courses, searchQuery, sourceType, selectedCourseId });

  useEffect(() => { setPage(1); }, [sourceType, selectedCourseId, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const { playItems, playerState, play, downloadingMp3, handleDownloadMp3 } =
    useNotesAudio({ filteredItems, selectedIds });

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

  const resolveVideoUrl = useCallback(async (videoRecordId: string): Promise<string | null> => {
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
              {selectedIds.size > 0 ? `Play Selected (${playItems.length})` : 'Play Notes'}
            </Button>
          )}
          {filteredItems.length > 0 && (
            <Button
              onClick={handleDownloadMp3}
              disabled={downloadingMp3}
              size="sm"
              variant="outline"
              className="flex items-center gap-1.5 shrink-0"
              title="Download as MP3"
            >
              {downloadingMp3 ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloadingMp3 ? 'Generating…' : `MP3${selectedIds.size > 0 ? ` (${playItems.length})` : ''}`}
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
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs font-bold text-[var(--primary)] hover:underline"
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
                    isSelected={selectedIds.has(note.id)}
                    onToggleSelect={() => toggleSelect(note.id)}
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
                    isSelected={selectedIds.has(entry.noteId)}
                    onToggleSelect={() => toggleSelect(entry.noteId)}
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
