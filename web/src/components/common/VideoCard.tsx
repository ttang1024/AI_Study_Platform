import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Youtube, Clock, Trash2, Sparkles, FolderInput, Pencil, Loader2, FileVideo } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { videoService } from '../../services/videoService';
import { MoveToCourseModal } from './MoveToCourseModal';
import { DeleteModal } from './DeleteModal';
import { Modal } from './Modal';

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
  sourceType?: 'youtube' | 'bilibili' | 'upload';
  courseColor: string;
  courseName: string;
  createdAt: string;
}

interface VideoCardProps {
  video: VideoCardData;
  to: string;
  onDeleted?: () => void;
  onMoved?: (newCourseId: string) => void;
  onUpdated?: (video: VideoCardData) => void;
  compact?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, to, onDeleted, onMoved, onUpdated, compact = false }) => {
  const { courses, refreshStats, deleteVideo } = useStudy();
  const tiltDir = hashCode(video.id) % 2 === 0 ? 1 : -1;
  const sourceType = video.sourceType ?? 'youtube';
  const isBilibili = sourceType === 'bilibili';
  const isUpload = sourceType === 'upload';
  const fallbackThumbnail = isBilibili
    ? '/images/bilibili.png'
    : isUpload
      ? ''
      : video.videoId
        ? `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`
        : '';
  const thumbnailSrc = isUpload
    ? videoService.getUploadedVideoThumbnailUrl(video.id)
    : (video.thumbnailUrl || fallbackThumbnail);
  const uploadPreviewUrl = isUpload ? videoService.getUploadedVideoStreamUrl(video.id) : '';
  const SourceIcon = isUpload ? FileVideo : Youtube;
  const sourceAccentClass = isBilibili ? 'bg-sky-500' : isUpload ? 'bg-primary' : 'bg-red-500';

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [renameDraft, setRenameDraft] = useState(video.title);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setTitle(video.title);
    setRenameDraft(video.title);
  }, [video.title]);

  useEffect(() => { setImgFailed(false); }, [video.thumbnailUrl]);

  const showVideoPreview = isUpload && (!thumbnailSrc || imgFailed);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteVideo(video.id);
      onDeleted?.();
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleMove = async (targetCourseId: string) => {
    await videoService.moveVideo(video.id, targetCourseId);
    refreshStats();
    onMoved?.(targetCourseId);
  };

  const openRenameModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRenameDraft(title);
    setRenameError(null);
    setShowRenameModal(true);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextTitle = renameDraft.trim();
    if (!nextTitle) {
      setRenameError('Title is required.');
      return;
    }

    setIsRenaming(true);
    setRenameError(null);
    try {
      const updated = await videoService.updateVideo(video.id, { title: nextTitle });
      setTitle(updated.title);
      onUpdated?.({ ...video, ...updated });
      setShowRenameModal(false);
    } catch {
      setRenameError('Unable to update the title.');
    } finally {
      setIsRenaming(false);
    }
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
            {showVideoPreview ? (
              <video
                src={`${uploadPreviewUrl}#t=0.1`}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : thumbnailSrc ? (
              <img
                src={thumbnailSrc}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
                onError={e => {
                  const img = e.target as HTMLImageElement;
                  if (fallbackThumbnail && img.dataset.fallbackUsed !== 'true') {
                    img.dataset.fallbackUsed = 'true';
                    img.src = fallbackThumbnail;
                  } else {
                    setImgFailed(true);
                  }
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-300">
                {isBilibili ? (
                  <img src="/images/bilibili.png" alt="" className="h-8 w-8 object-contain" />
                ) : (
                  <SourceIcon size={30} />
                )}
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className={`h-10 w-10 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg ${sourceAccentClass}`}>
                {isBilibili ? (
                  <img src="/images/bilibili-white.png" alt="" className="h-5 w-5 object-contain" />
                ) : (
                  <SourceIcon size={18} />
                )}
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
              {title}
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
            onClick={openRenameModal}
            title="Edit video title"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-400 shadow-sm hover:scale-110 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/30 hover:text-[var(--primary)] transition-all duration-200"
          >
            <Pencil size={13} />
          </button>
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

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete video"
        itemName={title}
        confirmLabel="Delete"
        isDeleting={isDeleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />

      <Modal
        isOpen={showRenameModal}
        onClose={() => !isRenaming && setShowRenameModal(false)}
        title="Edit video title"
        className="max-w-md"
      >
        <form onSubmit={handleRename} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Video title
            </label>
            <input
              autoFocus
              value={renameDraft}
              onChange={e => setRenameDraft(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-text-main outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
            />
            {renameError && <p className="mt-2 text-xs font-medium text-red-500">{renameError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRenameModal(false)}
              disabled={isRenaming}
              className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRenaming}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRenaming && <Loader2 size={13} className="animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Move modal */}
      {showMoveModal && (
        <MoveToCourseModal
          currentCourseId={video.courseId}
          courses={courses}
          itemName={title}
          onConfirm={handleMove}
          onClose={() => setShowMoveModal(false)}
        />
      )}
    </>
  );
};
