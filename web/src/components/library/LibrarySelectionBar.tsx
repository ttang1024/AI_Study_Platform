import React from 'react';
import { CheckSquare, X } from 'lucide-react';
import { LibraryAssignMenu, type AssignSelectionItem } from './LibraryAssignMenu';

interface Props {
  selection: AssignSelectionItem[];
  /** Selects every item on the current page. */
  onSelectAll: () => void;
  onClear: () => void;
  onChanged: (message: string) => void;
  /** Result of the last assign/unassign, shown until the next selection change. */
  status: string | null;
}

/**
 * The bulk action bar for the library grid. It only exists while something is selected, and is
 * fixed to the bottom of the viewport so it stays reachable while the user scrolls the grid
 * picking items.
 */
export const LibrarySelectionBar: React.FC<Props> = ({
  selection, onSelectAll, onClear, onChanged, status,
}) => {
  if (selection.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex max-w-full flex-wrap items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 shadow-xl">
        <span className="text-xs font-bold text-text-main">
          {selection.length} selected
        </span>

        <button
          onClick={onSelectAll}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-main"
        >
          <CheckSquare size={12} /> Select page
        </button>

        <span className="h-4 w-px bg-[var(--border-color)]" />

        <LibraryAssignMenu selection={selection} onChanged={onChanged} />

        {status && (
          <span className="max-w-xs truncate text-xs text-text-muted" title={status}>
            {status}
          </span>
        )}

        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-main"
        >
          <X size={12} /> Clear
        </button>
      </div>
    </div>
  );
};
