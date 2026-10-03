import React from 'react';
import { Loader2, Sparkles, Youtube, Globe, Mic, FileText } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Select } from '../common/Select';
import { Pagination } from '../common/Pagination';

export interface GlossarySource {
  id: string;
  name: string;
  kind: 'document' | 'article' | 'audio' | 'video';
  courseId?: string;
  onGenerate: () => void;
}

interface GlossaryGeneratePanelProps {
  sources: GlossarySource[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  courses: { id: string; name: string }[];
  generateCourseId: string | null;
  onSelectCourse: (id: string | null) => void;
  generating: Set<string>;
}

function kindIcon(kind: string) {
  if (kind === 'video') return <Youtube size={13} className="text-red-500 shrink-0" />;
  if (kind === 'article') return <Globe size={13} className="text-teal-500 shrink-0" />;
  if (kind === 'audio') return <Mic size={13} className="text-amber-500 shrink-0" />;
  return <FileText size={13} className="text-primary shrink-0" />;
}

export const GlossaryGeneratePanel: React.FC<GlossaryGeneratePanelProps> = ({
  sources,
  page,
  pageSize,
  onPageChange,
  courses,
  generateCourseId,
  onSelectCourse,
  generating,
}) => {
  const totalPages = Math.ceil(sources.length / pageSize);
  const pageSources = sources.slice((page - 1) * pageSize, page * pageSize);
  return (
          <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold text-text-main">Generate Glossary</h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {courses.length > 0 && (
                    <Select
                      value={generateCourseId ?? ''}
                      onChange={e => onSelectCourse(e.target.value || null)}
                      size="xs"
                      selectClassName="py-2 font-semibold"
                      aria-label="Filter glossary generation by course"
                    >
                      <option value="">All Courses</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-3">
                  <span className="text-xs text-text-muted">
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sources.length)} of {sources.length}
                  </span>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    className="pt-0"
                    size="sm"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pageSources.length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] p-6 text-center text-sm font-medium text-text-muted">
                  No sources available for glossary generation.
                </div>
              ) : pageSources.map(src => {
                const isLoading = generating.has(src.id);
                return (
                  <div key={src.id} className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] p-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {kindIcon(src.kind)}
                      <p className="text-xs font-medium text-text-main truncate">{src.name}</p>
                    </div>
                    <button
                      onClick={src.onGenerate}
                      disabled={isLoading}
                      className={cn(
                        'ml-2 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all',
                        'bg-primary text-white hover:opacity-90'
                      )}
                    >
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {isLoading ? '...' : 'Generate'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
  );
};
