import React from 'react';
import { motion } from 'motion/react';
import { Link as RouterLink } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, Zap } from 'lucide-react';
import { DocumentCard } from '../common/DocumentCard';
import { cn } from '../../utils/cn';
import type { Course, Document } from '../../types';

/** The staggered entrance every summarizer tab animates in with. */
export const container = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.09 } },
};

export const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

/**
 * The dashed drop target shared by the file-upload tabs: drag styling, the dotted backdrop, and the
 * invisible file input laid over it. `children` renders the empty/selected state inside.
 */
export function FileDropZone({
  hasFile, isDragging, onDraggingChange, onFile, accept, inputRef, className, children,
}: {
  hasFile: boolean;
  isDragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onFile: (file: File) => void;
  accept: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={item}
      onDragOver={e => { e.preventDefault(); onDraggingChange(true); }}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={e => { e.preventDefault(); onDraggingChange(false); onFile(e.dataTransfer.files[0]); }}
      className={cn(
        'group relative flex h-60 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all duration-500',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : hasFile
            ? 'border-emerald-400 bg-emerald-50/50'
            : 'border-zinc-200 bg-white hover:border-primary/40 hover:bg-primary/[0.02]',
        className,
      )}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, #d4d4d8 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      />
      <input
        ref={inputRef}
        type="file"
        className="absolute inset-0 z-10 cursor-pointer opacity-0"
        // Reset on click so re-picking the same file still fires onChange.
        onClick={e => { (e.target as HTMLInputElement).value = ''; }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        accept={accept}
      />
      {children}
    </motion.div>
  );
}

/** Label for a tab's submit button: working, already-imported, or ready to go. */
export function StartLearningLabel({ busy, duplicate }: { busy: boolean; duplicate?: unknown }) {
  if (busy) return <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" /> Processing...</span>;
  if (duplicate) return <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Already in Library</span>;
  return <span className="flex items-center gap-2"><Zap size={18} fill="currentColor" /> Start Learning</span>;
}

/** The "Recent Documents" strip under the upload tabs. Renders nothing when the library is empty. */
export function RecentDocuments({ docs, getCourse }: {
  docs: Document[];
  getCourse: (courseId: string) => Course | undefined;
}) {
  if (docs.length === 0) return null;
  return (
    <motion.div variants={item} className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-main">Recent Documents</h3>
        <RouterLink to="/library" className="flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline">
          View All <ArrowRight size={12} />
        </RouterLink>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map(doc => (
          <DocumentCard key={doc.id} doc={doc} course={getCourse(doc.courseId)} compact />
        ))}
      </div>
    </motion.div>
  );
}
