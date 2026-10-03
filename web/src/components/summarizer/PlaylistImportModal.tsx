import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListVideo, X, Loader2, Check, AlertTriangle, CheckSquare, Square, Zap } from 'lucide-react';
import { videoService, VideoListItem, PlaylistVideoItemData } from '../../services/videoService';
import { cn } from '../../utils/cn';

export interface PlaylistImportModalProps {
  playlistId?: string;
  videoUrl?: string;
  courseId: string;
  existingVideos: VideoListItem[];
  source?: 'youtube' | 'bilibili';
  onClose: () => void;
  onComplete: () => void;
}

export const PlaylistImportModal: React.FC<PlaylistImportModalProps> = ({
  playlistId, videoUrl, courseId, existingVideos, source = 'youtube', onClose, onComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [videos, setVideos] = useState<PlaylistVideoItemData[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; currentTitle: string } | null>(null);
  const [done, setDone] = useState(false);

  const isBilibili = source === 'bilibili';
  const accent = isBilibili ? 'sky' : 'red';
  const existingByVideoId = new Map(
    existingVideos
      .filter(v => (v.sourceType ?? 'youtube') === source)
      .map(v => [v.videoId, v]),
  );
  const selectableVideos = videos.filter(v => !existingByVideoId.has(v.videoId));

  useEffect(() => {
    const request = isBilibili
      ? videoService.getBilibiliItems(videoUrl ?? '')
      : videoService.getPlaylistItems(playlistId ?? '');

    request
      .then(items => {
        setVideos(items);
        setSelected(new Set(items.filter(v => !existingByVideoId.has(v.videoId)).map(v => v.videoId)));
      })
      .catch(() => setError(isBilibili ? 'Failed to load Bilibili videos. The link may be private or unavailable.' : 'Failed to load playlist. The playlist may be private or unavailable.'))
      .finally(() => setLoading(false));
  }, [playlistId, videoUrl, isBilibili]);

  const allSelected = selectableVideos.length > 0 && selected.size === selectableVideos.length;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableVideos.map(v => v.videoId)));
  };

  const toggleOne = (id: string) => {
    if (existingByVideoId.has(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    const toImport = videos.filter(v => selected.has(v.videoId) && !existingByVideoId.has(v.videoId));
    if (toImport.length === 0) return;
    setImporting(true);
    for (let i = 0; i < toImport.length; i++) {
      const v = toImport[i];
      setImportProgress({ current: i + 1, total: toImport.length, currentTitle: v.title });
      try {
        const itemUrl = isBilibili
          ? `https://www.bilibili.com/video/${v.videoId.split(':p')[0]}${v.videoId.includes(':p') ? `?p=${v.videoId.split(':p')[1]}` : ''}`
          : `https://www.youtube.com/watch?v=${v.videoId}`;
        await videoService.createVideo({
          courseId,
          videoId: v.videoId,
          videoUrl: v.videoUrl ?? itemUrl,
          sourceType: source,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          summary: null,
        });
      } catch {
        // continue on individual failure
      }
    }
    setImporting(false);
    setImportProgress(null);
    setDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !importing) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className={cn('rounded-xl p-2 text-white', isBilibili ? 'bg-sky-500' : 'bg-red-500')}>
              {isBilibili ? (
                <img src="/images/bilibili-white.png" alt="" className="h-[18px] w-[18px] object-contain" />
              ) : (
                <ListVideo size={18} />
              )}
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900">{isBilibili ? 'Import Bilibili Videos' : 'Import Playlist'}</h2>
              {!loading && !error && (
                <p className="text-xs text-zinc-400">{videos.length} video{videos.length !== 1 ? 's' : ''} found</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[400px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400">
              <Loader2 size={28} className={cn('animate-spin', isBilibili ? 'text-sky-400' : 'text-red-400')} />
              <p className="text-sm">{isBilibili ? 'Loading Bilibili videos…' : 'Loading playlist…'}</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 px-6 text-center">
              <p className="text-sm font-bold text-red-500">{error}</p>
            </div>
          )}
          {done && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="rounded-full bg-emerald-100 p-4">
                <Check size={28} className="text-emerald-500" />
              </div>
              <p className="text-base font-black text-zinc-900">Import complete!</p>
              <p className="text-sm text-zinc-400">Videos have been added to your course.</p>
            </div>
          )}
          {!loading && !error && !done && videos.map(v => {
            const existingVideo = existingByVideoId.get(v.videoId);
            return (
              <label
                key={v.videoId}
                className={cn(
                  'flex items-center gap-3 px-5 py-3 transition-colors border-b border-zinc-50 last:border-0',
                  existingVideo ? 'cursor-not-allowed bg-zinc-50/60' : 'hover:bg-zinc-50 cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!existingVideo && selected.has(v.videoId)}
                  onChange={() => toggleOne(v.videoId)}
                  disabled={importing || !!existingVideo}
                />
                <div className={cn(
                  'shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                  existingVideo
                    ? 'border-zinc-200 bg-zinc-100'
                    : selected.has(v.videoId) ? `${isBilibili ? 'bg-sky-500 border-sky-500' : 'bg-red-500 border-red-500'}` : 'border-zinc-300 bg-white',
                )}>
                  {!existingVideo && selected.has(v.videoId) && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                <img
                  src={v.thumbnailUrl}
                  alt={v.title}
                  referrerPolicy={isBilibili ? 'no-referrer' : undefined}
                  className="w-20 h-[45px] rounded-lg object-cover shrink-0 bg-zinc-100"
                />
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-800 leading-tight line-clamp-2">{v.title}</span>
                  {existingVideo && (
                    <span className="inline-flex items-center gap-1 self-start text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                      <AlertTriangle size={9} />
                      Already in {existingVideo.courseName}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {!loading && !error && !done && (
          <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-between gap-3">
            <button
              onClick={toggleAll}
              disabled={importing}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-40"
            >
              {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onClose} disabled={importing} className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-700 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white transition-all',
                  selected.size > 0 && !importing
                    ? isBilibili ? 'bg-sky-500 hover:bg-sky-600 active:scale-95' : 'bg-red-500 hover:bg-red-600 active:scale-95'
                    : 'bg-zinc-200 text-zinc-400 cursor-not-allowed',
                )}
              >
	                {importing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {importProgress ? `${importProgress.current}/${importProgress.total}` : 'Importing…'}
                  </>
                ) : (
                  <>
                    <Zap size={14} fill="currentColor" />
                    Import {selected.size > 0 ? `${selected.size} video${selected.size !== 1 ? 's' : ''}` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        {done && (
          <div className="px-5 py-4 border-t border-zinc-100 flex justify-end">
            <button onClick={onComplete} className={cn('px-4 py-2 rounded-xl text-sm font-black text-white active:scale-95 transition-all', isBilibili ? 'bg-sky-500 hover:bg-sky-600' : 'bg-red-500 hover:bg-red-600')}>
              Done
            </button>
          </div>
        )}

        <AnimatePresence>
          {importing && importProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-5 pb-4"
            >
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span className="truncate max-w-[280px]">{importProgress.currentTitle}</span>
                <span className="shrink-0 ml-2">{importProgress.current}/{importProgress.total}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', accent === 'sky' ? 'bg-sky-500' : 'bg-red-500')}
                  animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
