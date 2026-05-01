import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, FileType, FileCode, Globe, Clock, Trash2, Sparkles, Mic, Rss, FolderInput, AlertTriangle, Loader2 } from 'lucide-react';
import { Document, Course } from '../../types';
import { cn } from '../../utils/cn';
import { getDocDisplayName } from '../../utils/docName';
import { documentService } from '../../services/documentService';
import { useStudy } from '../../context/StudyContext';
import { MoveToCourseModal } from './MoveToCourseModal';

interface DocumentCardProps {
  doc: Document;
  course?: Course;
  to?: string;
  compact?: boolean;
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 16 },
  show: { opacity: 1, scale: 1, y: 0 },
};

function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const FILE_META: Record<string, { icon: React.ElementType; label: string; emoji: string }> = {
  pdf: { icon: FileText, label: 'PDF', emoji: '📄' },
  docx: { icon: FileText, label: 'DOCX', emoji: '📝' },
  txt: { icon: FileType, label: 'TXT', emoji: '📃' },
  md: { icon: FileCode, label: 'MD', emoji: '✍️' },
  web: { icon: Globe, label: 'Web', emoji: '🌐' },
  audio: { icon: Mic, label: 'Audio', emoji: '🎙️' },
  podcast: { icon: Rss, label: 'Podcast', emoji: '🎧' },
};

export const DocumentCard: React.FC<DocumentCardProps> = ({ doc, course, to, compact = false }) => {
  const { courses, deleteDocument, updateDocumentInList } = useStudy();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const formattedDate = new Date(doc.uploadDate).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  let summaryText: string | null = null;
  if (doc.summary) {
    try {
      const parsed = JSON.parse(doc.summary);
      summaryText = parsed.summary || null;
    } catch {
      summaryText = doc.summary;
    }
  }

  let transcriptText: string | null = null;
  if (doc.transcript) {
    try {
      const chunks = JSON.parse(doc.transcript) as { text: string }[];
      transcriptText = chunks.map(c => c.text).join(' ');
    } catch {
      transcriptText = doc.transcript;
    }
  }

  const hash = useMemo(() => hashCode(doc.id), [doc.id]);
  const fileMeta = doc.originalUrl ? FILE_META.web : (FILE_META[doc.type] ?? FILE_META.pdf);
  const Icon = fileMeta.icon;
  const accent = course?.color || 'var(--primary)';
  const tiltDir = hash % 2 === 0 ? 1 : -1;

  const blobA = ['top-right', 'top-left', 'top-right', 'center-right'][hash % 4];
  const blobB = ['bottom-left', 'bottom-right', 'bottom-left', 'bottom-left'][hash % 4];

  const blobPos: Record<string, string> = {
    'top-right': '-top-5 -right-5',
    'top-left': '-top-5 -left-5',
    'center-right': 'top-1/2 -right-4 -translate-y-1/2',
    'bottom-left': '-bottom-5 -left-5',
    'bottom-right': '-bottom-5 -right-5',
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try { await deleteDocument(doc.courseId || '', doc.id); }
    finally { setIsDeleting(false); setShowDeleteModal(false); }
  };

  const handleMove = async (targetCourseId: string) => {
    const updated = await documentService.moveDocument(doc.courseId || '', doc.id, targetCourseId);
    updateDocumentInList(updated);
  };

  return (
    <>
      <motion.div
        layout
        variants={cardVariants}
        initial="hidden"
        animate="show"
        exit={{ opacity: 0, scale: 0.88, y: -12 }}
        whileHover={{ y: -1, rotate: tiltDir * 0.1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className={cn('group relative', compact ? 'h-[190px]' : 'h-[260px]')}
      >
        <Link
          to={to ?? (doc.type === 'audio' || doc.type === 'podcast' ? `/audio/${doc.id}` : `/documents/${doc.id}`)}
          className="flex flex-col h-full overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-sm transition-all duration-300 group-hover:border-transparent group-hover:shadow-xl"
        >
          {/* ── Summary cover ── */}
          <div
            className={cn('relative overflow-hidden shrink-0', compact ? 'h-[90px]' : 'h-[165px]')}
            style={{ backgroundColor: `${accent}12` }}
          >
            <div className="absolute inset-x-0 top-0 h-[3px] z-10" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}66)` }} />
            <div className={cn('absolute w-24 h-24 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125', blobPos[blobA])} style={{ backgroundColor: accent, opacity: 0.18 }} />
            <div className={cn('absolute w-16 h-16 rounded-full blur-xl transition-transform duration-500 group-hover:scale-110', blobPos[blobB])} style={{ backgroundColor: accent, opacity: 0.12 }} />
            <div className="absolute -right-1 bottom-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6 pointer-events-none select-none" style={{ color: accent, opacity: 0.12 }}>
              <Icon size={compact ? 72 : 96} />
            </div>

            <span className="absolute top-4 left-3 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border" style={{ color: accent, borderColor: `${accent}35`, backgroundColor: `${accent}18` }}>
              {fileMeta.emoji} {fileMeta.label}
            </span>

            {summaryText && (
              <span className="absolute top-4 right-3 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border border-amber-300/60 bg-amber-50/80 text-amber-600">
                <Sparkles size={9} />
                AI Summary
              </span>
            )}

            <div className="absolute inset-0 flex items-center px-4 pt-8 pb-1">
              {summaryText ? (
                <p className={cn('text-[11px] leading-relaxed relative z-10', compact ? 'line-clamp-2' : 'line-clamp-6')} style={{ color: `color-mix(in srgb, ${accent} 80%, #000)` }}>
                  {summaryText}
                </p>
              ) : transcriptText ? (
                <p className={cn('text-[11px] leading-relaxed relative z-10 text-text-muted', compact ? 'line-clamp-2' : 'line-clamp-6')}>{transcriptText}</p>
              ) : (
                <div className="flex flex-col gap-1.5 w-full relative z-10">
                  <div className="h-2.5 w-full rounded-full" style={{ backgroundColor: `${accent}22` }} />
                  <div className="h-2.5 w-5/6 rounded-full" style={{ backgroundColor: `${accent}22` }} />
                  <div className="h-2.5 w-3/4 rounded-full" style={{ backgroundColor: `${accent}22` }} />
                  {!compact && <>
                    <div className="h-2.5 w-11/12 rounded-full" style={{ backgroundColor: `${accent}22` }} />
                    <div className="h-2.5 w-2/3 rounded-full" style={{ backgroundColor: `${accent}22` }} />
                    <div className="h-2.5 w-4/5 rounded-full" style={{ backgroundColor: `${accent}22` }} />
                  </>}
                </div>
              )}
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
            {course ? (
              <span className="w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: accent }}>{course.name}</span>
            ) : (
              <span className="w-fit rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-400">Uncategorized</span>
            )}
            <h3 className="line-clamp-1 text-sm font-bold leading-snug text-text-main transition-colors duration-200 group-hover:text-[var(--primary)]">{getDocDisplayName(doc)}</h3>
            <div className="flex items-center justify-between mt-auto pt-1 border-t border-[var(--border-color)]">
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Clock size={9} />
                {formattedDate}
              </div>
              <div className="flex items-center gap-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Sparkles size={9} style={{ color: accent }} />
                <span style={{ color: accent }} className="font-semibold">Open</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Action buttons */}
        <div className="absolute right-3 top-4 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={e => { e.preventDefault(); setShowMoveModal(true); }}
            title="Move to course"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-zinc-200 text-zinc-400 shadow-sm hover:scale-110 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-500 transition-all duration-200"
          >
            <FolderInput size={13} />
          </button>
          <button
            onClick={e => { e.preventDefault(); setShowDeleteModal(true); }}
            title="Delete document"
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
                  <h3 className="text-lg font-bold text-zinc-900">Delete Document</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Are you sure you want to delete <span className="font-semibold text-zinc-700 break-all">"{doc.name}"</span>? This action cannot be undone.
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
          currentCourseId={doc.courseId}
          courses={courses}
          itemName={doc.name}
          onConfirm={handleMove}
          onClose={() => setShowMoveModal(false)}
        />
      )}
    </>
  );
};
