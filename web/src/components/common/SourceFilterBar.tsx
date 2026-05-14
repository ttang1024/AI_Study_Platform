import React from 'react';
import { CONTENT_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { cn } from '../../utils/cn';
import { Course } from '../../types';
import { TypeFilterTabs, TypeTab } from './TypeFilterTabs';

export type SourceType = 'all' | 'document' | 'video' | 'article' | 'audio';

interface SourceFilterBarProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelectCourse: (id: string | null) => void;
  sourceType: SourceType;
  onSelectType: (type: SourceType) => void;
  counts?: { all: number; document: number; video: number; article: number; audio: number };
  courseCounts?: Record<string, number>;
  hideTypeTabs?: boolean;
}

const SOURCE_TABS: TypeTab<SourceType>[] = [
  { id: 'all',      label: 'All' },
  { id: 'document', label: 'Documents', icon: CONTENT_TYPE_ICONS.document.icon },
  { id: 'video',    label: 'Videos',    icon: CONTENT_TYPE_ICONS.video.icon },
  { id: 'article',  label: 'Articles',  icon: CONTENT_TYPE_ICONS.article.icon },
  { id: 'audio',    label: 'Audio',     icon: CONTENT_TYPE_ICONS.audio.icon },
];

export const SourceFilterBar: React.FC<SourceFilterBarProps> = ({
  courses,
  selectedCourseId,
  onSelectCourse,
  sourceType,
  onSelectType,
  counts,
  courseCounts,
  hideTypeTabs,
}) => {
  const tabs = SOURCE_TABS.map(t => ({
    ...t,
    count: counts?.[t.id],
  }));

  return (
    <div className="space-y-3">
      {!hideTypeTabs && <TypeFilterTabs tabs={tabs} active={sourceType} onChange={onSelectType} />}
      {/* Course filter pills */}
      {courses.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => onSelectCourse(null)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-semibold border transition-all',
              selectedCourseId === null
                ? 'bg-zinc-800 text-white border-zinc-800'
                : 'text-zinc-500 border-zinc-200 hover:border-zinc-400'
            )}
          >
            All Courses
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectCourse(c.id)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                selectedCourseId === c.id
                  ? 'text-white shadow-md'
                  : 'border border-[var(--border-color)] bg-[var(--bg-sidebar)] text-text-muted hover:border-[var(--primary)]/40',
              )}
              style={selectedCourseId === c.id ? { backgroundColor: c.color } : {}}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: selectedCourseId === c.id ? 'rgba(255,255,255,0.6)' : c.color }}
              />
              <span>{c.name}</span>
              {courseCounts && (
                <span
                  className={cn(
                    'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                    selectedCourseId === c.id
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--border-color)] text-text-muted',
                  )}
                >
                  {courseCounts[c.id] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
