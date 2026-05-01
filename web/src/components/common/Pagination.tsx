import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label?: string;
  showPrevNextText?: boolean;
  showPageNumbers?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  label,
  showPrevNextText = false,
  showPageNumbers = true,
  size = 'md',
  className,
}) => {
  if (totalPages <= 1) return null;

  const sm = size === 'sm';
  const iconSize = sm ? 14 : 20;

  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const prevBtn = (
    <button
      onClick={() => onPageChange(page - 1)}
      disabled={page <= 1}
      className={cn(
        'flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] text-text-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
        sm
          ? 'p-1.5 hover:border-primary/50 hover:text-primary'
          : showPrevNextText
            ? 'px-3 py-1.5 text-sm font-medium hover:border-[var(--primary)]/50'
            : 'p-2 hover:bg-zinc-50',
      )}
    >
      <ChevronLeft size={iconSize} />
      {showPrevNextText && !sm && 'Prev'}
    </button>
  );

  const nextBtn = (
    <button
      onClick={() => onPageChange(page + 1)}
      disabled={page >= totalPages}
      className={cn(
        'flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-sidebar)] text-text-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
        sm
          ? 'p-1.5 hover:border-primary/50 hover:text-primary'
          : showPrevNextText
            ? 'px-3 py-1.5 text-sm font-medium hover:border-[var(--primary)]/50'
            : 'p-2 hover:bg-zinc-50',
      )}
    >
      {showPrevNextText && !sm && 'Next'}
      <ChevronRight size={iconSize} />
    </button>
  );

  const pageNumbers = showPageNumbers && (
    <div className={cn('flex items-center', sm ? 'gap-0.5' : 'gap-1')}>
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={cn(
            'rounded-lg font-medium transition-all',
            sm
              ? cn('h-7 w-7 text-xs border', p === page
                ? 'border-primary bg-primary text-white'
                : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] text-text-muted hover:border-primary/50 hover:text-primary')
              : cn('w-10 h-10 text-sm', p === page
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'text-text-muted hover:bg-zinc-100'),
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );

  if (!showPageNumbers) {
    return (
      <div className={cn('flex items-center justify-center gap-3 pt-4', className)}>
        {prevBtn}
        {label && <span className="text-xs text-text-muted">{label}</span>}
        {nextBtn}
      </div>
    );
  }

  if (label) {
    return (
      <div className={cn('flex items-center justify-between pt-2', className)}>
        <span className={cn('text-text-muted', sm ? 'text-xs' : 'text-sm')}>{label}</span>
        <div className="flex items-center gap-1">
          {prevBtn}
          {pageNumbers}
          {nextBtn}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center gap-2 pt-4', className)}>
      {prevBtn}
      {pageNumbers}
      {nextBtn}
    </div>
  );
};
