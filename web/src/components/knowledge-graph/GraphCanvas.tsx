import React, { RefObject } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2, Network, Search } from 'lucide-react';
import { SourceFilterBar } from '../common/SourceFilterBar';
import { Course } from '../../types';

interface Props {
  wrapperRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  loading: boolean;
  error: string | null;
  hasNodes: boolean;
  search: string;
  setSearch: (v: string) => void;
  coursesWithMaterials: Course[];
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
}

export const GraphCanvas: React.FC<Props> = ({
  wrapperRef, svgRef, loading, error, hasNodes, search, setSearch,
  coursesWithMaterials, selectedCourseId, setSelectedCourseId,
}) => (
  <section className="flex h-[calc(100vh-10rem)] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-black/[0.06] p-4">
      <SourceFilterBar
        courses={coursesWithMaterials}
        selectedCourseId={selectedCourseId}
        onSelectCourse={setSelectedCourseId}
        sourceType="all"
        onSelectType={() => undefined}
        hideTypeTabs
        hideAllCoursesTab
      />
      <div className="relative w-full">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search concepts or materials"
          className="h-10 w-full rounded-xl border border-black/[0.08] bg-[var(--bg-app)] pl-9 pr-3 text-sm text-text-main outline-none transition focus:border-[var(--primary)]"
        />
      </div>
    </div>
    <div ref={wrapperRef} className="relative min-h-0 flex-1 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.09)_1px,transparent_0)] [background-size:22px_22px]">
      {loading ? (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-text-muted">
          <Loader2 size={18} className="animate-spin" />
          Loading graph
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center gap-2 text-sm text-red-600">
          <AlertCircle size={18} />
          {error}
        </div>
      ) : !hasNodes ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <Network size={34} className="text-text-muted" />
          <p className="mt-3 text-sm font-semibold text-text-main">No graph nodes match this view</p>
          <p className="mt-1 max-w-md text-sm text-text-muted">Generate glossary terms or mind maps from your materials to add concept relationships.</p>
          <Link to="/library?view=add" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
            Add material
            <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <>
          <svg ref={svgRef} className="h-full w-full" role="img" aria-label="Knowledge graph" />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-black/[0.06] bg-white/90 px-3 py-2 text-xs text-text-muted shadow-sm backdrop-blur">
            Drag nodes. Scroll to zoom. Click a node for details.
          </div>
        </>
      )}
    </div>
  </section>
);
