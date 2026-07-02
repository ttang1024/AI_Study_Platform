import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../utils/cn';

export type MasteryFilter = 'all' | 'unmastered' | 'mastered';

const masteryTabs: { id: MasteryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unmastered', label: 'Learning' },
  { id: 'mastered', label: 'Mastered' },
];

interface GlossaryMasteryFilterProps {
  value: MasteryFilter;
  onChange: (filter: MasteryFilter) => void;
  totalCount: number;
  masteredCount: number;
  filteredCount: number;
  playing: boolean;
}

/** All / Learning / Mastered status tabs with per-status counts. */
export const GlossaryMasteryFilter: React.FC<GlossaryMasteryFilterProps> = ({
  value, onChange, totalCount, masteredCount, filteredCount, playing,
}) => (
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold text-text-muted">Status:</span>
    <div className="flex items-center gap-1">
      {masteryTabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
            value === tab.id
              ? tab.id === 'mastered'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : tab.id === 'unmastered'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-zinc-800 text-white'
              : 'border border-[var(--border-color)] text-text-muted hover:border-zinc-400',
          )}
        >
          {tab.id === 'mastered' && <CheckCircle2 size={12} />}
          {tab.id === 'unmastered' && <Circle size={12} />}
          {tab.label}
          {tab.id === 'mastered' && masteredCount > 0 && (
            <span className="rounded-full bg-emerald-200 px-1.5 text-emerald-700">{masteredCount}</span>
          )}
          {tab.id === 'unmastered' && totalCount > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 text-amber-600">{totalCount - masteredCount}</span>
          )}
        </button>
      ))}
    </div>
    {value !== 'all' && (
      <span className="text-xs text-text-muted ml-1">
        · {filteredCount} term{filteredCount !== 1 ? 's' : ''} shown
        {playing && ' · playing filtered list'}
      </span>
    )}
  </div>
);
