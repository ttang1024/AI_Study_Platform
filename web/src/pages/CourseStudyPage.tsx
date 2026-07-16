import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { CourseArtifactsWorkspace } from '../components/course/CourseArtifactsWorkspace';
import { EmbeddedPage } from '../components/course/EmbeddedPage';
import { MaterialsSidebar } from '../components/course/MaterialsSidebar';
import { useCourseStudy } from './courseStudy/useCourseStudy';

export const CourseStudyPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const s = useCourseStudy(courseId);

  // Layout
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sidebar = (
    <MaterialsSidebar
      courseName={s.course?.name}
      accent={s.accent}
      documents={s.documents}
      videos={s.videos}
      filteredDocs={s.filteredDocs}
      filteredVideos={s.filteredVideos}
      isLoadingMaterials={s.isLoadingMaterials}
      selected={s.selected}
      studiedIds={s.studiedIds}
      search={s.search}
      setSearch={s.setSearch}
      filterUnstudied={s.filterUnstudied}
      setFilterUnstudied={s.setFilterUnstudied}
      onSelect={(next) => { s.setSelected(next); setSidebarOpen(false); }}
      toggleStudied={s.toggleStudied}
    />
  );

  return (
    <div className="flex h-screen flex-col bg-[var(--bg-app)]">

      {/* ── Top bar ── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Mobile: toggle materials sidebar */}
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="flex xl:hidden items-center justify-center h-8 w-8 rounded-lg border border-[var(--border-color)] text-text-muted hover:text-text-main transition-colors"
          >
            {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
          </button>

          <div className="hidden xl:flex items-center gap-2">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.accent }} />
            <span className="text-sm font-semibold text-text-main">{s.course?.name ?? '…'}</span>
            {s.itemName && (
              <>
                <span className="text-text-muted">/</span>
                <span className="text-sm text-text-muted">{s.itemName}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-1">
          {(['study', 'artifacts'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => s.setWorkspaceMode(mode)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors',
                s.workspaceMode === mode ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main',
              )}
            >
              {mode === 'study' ? 'Study' : 'Artifacts'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Materials sidebar — desktop fixed */}
        <div className={cn(
          'hidden xl:flex xl:shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] relative transition-all duration-200',
          sidebarCollapsed ? 'xl:w-10' : 'xl:w-64',
        )}>
          {!sidebarCollapsed && sidebar}

          {/* Collapse/expand toggle */}
          <button
            onClick={() => setSidebarCollapsed(p => !p)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-text-muted hover:text-text-main shadow-sm transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Materials sidebar — mobile overlay */}
        {sidebarOpen && (
          <div className="absolute inset-0 z-30 flex xl:hidden">
            <div className="w-72 flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] h-full shadow-2xl">
              {sidebar}
            </div>
            <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* Embedded detail page */}
        <div className="flex-1 overflow-hidden">
          {s.workspaceMode === 'study' ? (
            <EmbeddedPage selected={s.selected} />
          ) : (
            <CourseArtifactsWorkspace
              course={s.course}
              documents={s.documents}
              videos={s.videos}
              selected={s.selected}
              setSelected={(next) => {
                s.setSelected(next);
                s.setWorkspaceMode('study');
              }}
              artifacts={s.artifactsWithFlashcards}
              loading={s.isLoadingArtifacts}
            />
          )}
        </div>
      </div>
    </div>
  );
};
