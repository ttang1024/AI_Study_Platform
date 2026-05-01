import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, Clock, Trash2, Sparkles, FolderInput, AlertTriangle, Loader2 } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { youtubeService } from '../../services/youtubeService';
import { MoveToCourseModal } from './MoveToCourseModal';

function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface VideoCardData {
  id: string;
  courseId: string;
  title: string;
  thumbnailUrl: string;
  /** YouTube video ID used for thumbnail fallback URL */
  videoId?: string;
  courseColor: string;
  courseName: string;
  createdAt: string;
}

interface VideoCardProps {
  video: VideoCardData;
  to: string;
  onDeleted?: () => void;
  onMoved?: (newCourseId: string) => void;
  compact?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, to, onDeleted, onMoved, compact = false }) => {
  const { courses, refreshStats } = useStudy();
  const tiltDir = hashCode(video.id) % 2 === 0 ? 1 : -1;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await youtubeService.deleteVideo(video.id);
      refreshStats();
      onDeleted?.();
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleMove = async (targetCourseId: string) => {
    await youtubeService.moveVideo(video.id, targetCourseId);
    refreshStats();
    onMoved?.(targetCourseId);
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -1, rotate: tiltDir * 0.1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className={`group relative ${compact ? 'h-[210px]' : 'h-[260px]'}`}
      >
        <Link
          to={to}
          className="flex flex-col h-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden hover:border-[var(--primary)]/30 hover:shadow-lg transition-all"
        >
          {/* Thumbnail */}
          <div className={`relative shrink-0 overflow-hidden bg-zinc-100 ${compact ? 'h-[120px]' : 'h-[165px]'}`}>
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={e => {
                if (video.videoId) {
                  (e.target as HTMLImageElement).src =
                    `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
                }
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                <Youtube size={18} />
              </div>
            </div>
          </div>

          {/* Body */}
          <div className={`flex-1 space-y-2 ${compact ? 'p-2 pt-1.5' : 'p-4 pt-2'}`}>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: video.courseColor }}
              >
                {video.courseName}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-text-main line-clamp-1 leading-snug">
              {video.title}
            </h3>
            <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)]">
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Clock size={10} />
                {formatDate(video.createdAt)}
              </div>
              <div className="flex items-center gap-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Sparkles size={9} style={{ color: video.courseColor }} />
                <span style={{ color: video.courseColor }} className="font-semibold">Open</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Action buttons */}
        <div className="absolute right-3 top-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={e => { e.preventDefault(); setShowMoveModal(true); }}
            title="Move to course"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-400 shadow-sm hover:scale-110 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-500 transition-all duration-200"
          >
            <FolderInput size={13} />
          </button>
          <button
            onClick={e => { e.preventDefault(); setShowDeleteModal(true); }}
            title="Delete video"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-400 shadow-sm hover:scale-110 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all duration-200"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </motion.div>

      {/* Delete modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => !isDeleting && setShowDeleteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Delete Video</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Are you sure you want to delete <span className="font-semibold text-zinc-700 break-all">"{video.title}"</span>? This action cannot be undone.
                  </p>
                </div>
                <div className="flex w-full gap-3 pt-2">
                  <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting}
                    className="flex-1 rounded-2xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >Cancel</button>
                  <button onClick={handleDelete} disabled={isDeleting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Move modal */}
      {showMoveModal && (
        <MoveToCourseModal
          currentCourseId={video.courseId}
          courses={courses}
          itemName={video.title}
          onConfirm={handleMove}
          onClose={() => setShowMoveModal(false)}
        />
      )}
    </>
  );
};
