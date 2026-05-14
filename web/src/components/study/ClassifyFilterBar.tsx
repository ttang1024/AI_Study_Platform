import React from 'react';
import { cn } from '../../utils/cn';
import { DIFFICULTY_COLORS } from './FlashcardClassifyModal';

interface ClassifyFilterBarProps {
  allTags: string[];
  filterDifficulty: 'easy' | 'medium' | 'hard' | null;
  onDifficultyChange: (d: 'easy' | 'medium' | 'hard' | null) => void;
  filterChapter: string;
  onChapterChange: (c: string) => void;
  filterTags: string[];
  onTagsChange: (tags: string[]) => void;
  filteredCardCount: number;
}

export const ClassifyFilterBar: React.FC<ClassifyFilterBarProps> = ({
  allTags,
  filterDifficulty,
  onDifficultyChange,
  filterChapter,
  onChapterChange,
  filterTags,
  onTagsChange,
  filteredCardCount,
}) => {
  const isActive = filterDifficulty !== null || filterChapter.trim() !== '' || filterTags.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      {/* Difficulty */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted shrink-0">Difficulty:</span>
        <div className="flex gap-1">
          {([null, 'easy', 'medium', 'hard'] as const).map(d => (
            <button
              key={d ?? 'all'}
              onClick={() => onDifficultyChange(d)}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-bold border transition-all',
                filterDifficulty === d
                  ? d
                    ? DIFFICULTY_COLORS[d]
                    : 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--bg-app)] text-text-muted border-[var(--border-color)] hover:border-[var(--primary)]/50',
              )}
            >
              {d ? d.charAt(0).toUpperCase() + d.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Chapter */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted shrink-0">Chapter:</span>
        <input
          value={filterChapter}
          onChange={e => onChapterChange(e.target.value)}
          placeholder="Filter..."
          className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-2.5 py-0.5 text-xs outline-none focus:border-[var(--primary)] transition-colors w-28"
        />
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted shrink-0">Tags:</span>
          {allTags.slice(0, 10).map(t => (
            <button
              key={t}
              onClick={() => onTagsChange(
                filterTags.includes(t)
                  ? filterTags.filter(x => x !== t)
                  : [...filterTags, t],
              )}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-all',
                filterTags.includes(t)
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30'
                  : 'bg-[var(--bg-app)] text-text-muted border-[var(--border-color)] hover:border-[var(--primary)]/50',
              )}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* Active filter summary + clear */}
      {isActive && (
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--primary)]">{filteredCardCount} cards</span>
          <button
            onClick={() => { onDifficultyChange(null); onChapterChange(''); onTagsChange([]); }}
            className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
