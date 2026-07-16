import React from 'react';
import { Youtube, FileVideo, Loader2, Search, BookOpen, CheckCircle2, Circle, Filter } from 'lucide-react';
import { Document } from '../../types';
import { VideoListItem } from '../../services/videoService';
import { cn } from '../../utils/cn';
import { CourseStudySelected } from './CourseArtifactsWorkspace';
import { FILE_META, getVideoThumbSrc, getVideoThumbFallback } from '../../pages/courseStudy/helpers';

interface Props {
  courseName?: string;
  accent: string;
  documents: Document[];
  videos: VideoListItem[];
  filteredDocs: Document[];
  filteredVideos: VideoListItem[];
  isLoadingMaterials: boolean;
  selected: CourseStudySelected;
  studiedIds: Set<string>;
  search: string;
  setSearch: (v: string) => void;
  filterUnstudied: boolean;
  setFilterUnstudied: (fn: (p: boolean) => boolean) => void;
  onSelect: (selected: CourseStudySelected) => void;
  toggleStudied: (id: string) => void;
}

export const MaterialsSidebar: React.FC<Props> = ({
  courseName, accent, documents, videos, filteredDocs, filteredVideos, isLoadingMaterials,
  selected, studiedIds, search, setSearch, filterUnstudied, setFilterUnstudied, onSelect, toggleStudied,
}) => (
  <div className="flex flex-col h-full">
    {/* Course header */}
    <div className="shrink-0 px-4 py-3 border-b border-[var(--border-color)]" style={{ borderTop: `3px solid ${accent}` }}>
      <h2 className="text-sm font-bold text-text-main truncate">{courseName ?? '…'}</h2>
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
                      onClick={() => onSelect({ kind: 'doc', data: doc })}
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
                      onClick={() => onSelect({ kind: 'video', data: video })}
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
