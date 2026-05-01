import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Course } from '../../types';
import { cn } from '../../utils/cn';

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Called when the user presses Enter. If omitted, filtering is assumed live (onChange only). */
  onSearchSubmit?: () => void;
  placeholder?: string;
  courses: Course[];
  selectedCourseId: string | null;
  onCourseChange: (id: string | null) => void;
  /** Count shown on the "All" badge */
  allCount?: number;
  /** Count per course id shown on each course badge */
  courseCounts?: Record<string, number>;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  placeholder = 'Search...',
  courses,
  selectedCourseId,
  onCourseChange,
  allCount,
  courseCounts,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-center">
      {/* Search */}
      <div className="relative w-full sm:w-72 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
        <input
          type="text"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] py-2 pl-9 pr-3 text-sm text-text-main outline-none focus:border-[var(--primary)] transition-all placeholder:text-text-muted"
        />
      </div>

      {/* Divider */}
      <div className="hidden sm:block h-6 w-px bg-[var(--border-color)] shrink-0" />

      {/* Course filter pills */}
      <div className="flex items-center gap-1.5 w-full overflow-x-auto no-scrollbar">
        <Filter size={14} className="shrink-0 text-zinc-400" />

        <button
          onClick={() => onCourseChange(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5',
            selectedCourseId === null
              ? 'bg-[var(--primary)] text-white'
              : 'text-text-muted hover:text-text-main hover:bg-[var(--border-color)]',
          )}
        >
          All
          {allCount !== undefined && (
            <span className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-bold',
              selectedCourseId === null ? 'bg-white/20 text-white' : 'bg-[var(--border-color)] text-text-muted',
            )}>
              {allCount}
            </span>
          )}
        </button>

        {courses.map(course => {
          const isSelected = selectedCourseId === course.id;
          return (
            <button
              key={course.id}
              onClick={() => onCourseChange(course.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5',
                isSelected ? 'text-white' : 'text-text-muted hover:text-text-main hover:bg-[var(--border-color)]',
              )}
              style={isSelected ? { backgroundColor: course.color } : {}}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : course.color }}
              />
              {course.name}
              {courseCounts !== undefined && (
                <span className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-bold',
                  isSelected ? 'bg-white/20 text-white' : 'bg-[var(--border-color)] text-text-muted',
                )}>
                  {courseCounts[course.id] ?? 0}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
