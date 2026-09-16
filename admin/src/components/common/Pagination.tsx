import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

/** Prev/next pager under an admin table. Renders nothing when there is only one page. */
export const Pagination: React.FC<{
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-[var(--text-secondary)]">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" aria-label="Previous page" className="h-9 w-10" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={14} />
        </Button>
        <Button variant="outline" size="sm" aria-label="Next page" className="h-9 w-10" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
};
