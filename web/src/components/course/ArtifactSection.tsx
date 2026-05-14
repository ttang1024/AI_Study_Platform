import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ArtifactKind =
  | 'summaries'
  | 'notes'
  | 'flashcards'
  | 'questions'
  | 'glossary'
  | 'workedProblems'
  | 'mindmaps'
  | 'chats';

interface ArtifactSectionProps {
  id: ArtifactKind;
  icon: React.ElementType;
  color: string;
  title: string;
  count: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activeArtifact: ArtifactKind | null;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}

export const ArtifactSection: React.FC<ArtifactSectionProps> = ({
  id,
  icon: Icon,
  color,
  title,
  count,
  page,
  totalPages,
  onPageChange,
  activeArtifact,
  headerExtra,
  children,
}) => (
  <div
    id={`artifact-section-${id}`}
    className={cn(
      'scroll-mt-6 rounded-2xl border bg-white p-4 shadow-sm transition-all',
      activeArtifact === id ? 'border-primary shadow-md shadow-primary/10' : 'border-[var(--border-color)]',
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-1 min-w-0 items-center gap-2 flex-wrap">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
          <Icon size={16} />
        </div>
        <h3 className="font-bold text-text-main shrink-0">{title}</h3>
        {headerExtra && <div className="flex items-center">{headerExtra}</div>}
      </div>
      <span className="shrink-0 rounded-full bg-[var(--bg-app)] px-2 py-0.5 text-xs font-bold text-text-muted">{count}</span>
    </div>
    <div className="mt-3 space-y-2">{children}</div>
    {totalPages > 1 && (
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border-color)] pt-3">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-xs font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="text-xs font-bold text-text-muted">Page {page} of {totalPages}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-color)] px-2.5 py-1.5 text-xs font-bold text-text-muted hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border-color)] disabled:hover:text-text-muted"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    )}
  </div>
);
