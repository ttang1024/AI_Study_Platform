import React, { useRef } from 'react';
import { QuizPreviewModal } from '../../components/quiz/QuizPreviewModal';
import { ConceptPreviewModal } from '../../components/knowledge-graph/ConceptPreviewModal';
import { NotePreviewModal } from '../../components/knowledge-graph/NotePreviewModal';
import { GraphCanvas } from '../../components/knowledge-graph/GraphCanvas';
import { KnowledgeGraphSidebar } from '../../components/knowledge-graph/KnowledgeGraphSidebar';
import { useGraphSimulation } from '../../components/knowledge-graph/useGraphSimulation';
import { useKnowledgeGraph } from './useKnowledgeGraph';

/**
 * The Concept Map tab of /insights. Loaded lazily by the page: it pulls in d3, which is far too
 * big to sit in the chunk of a tab most visits never open.
 */
export const GraphTab: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const g = useKnowledgeGraph();

  useGraphSimulation(svgRef, wrapperRef, g.filtered, g.gapById, g.showGaps, g.setSelected);

  return (
    <div className="space-y-5">
      {/* The title and blurb belong to the /insights shell above the tab bar; the library
          totals ride in the right rail alongside the rest of the graph's summary cards. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <GraphCanvas
          wrapperRef={wrapperRef}
          svgRef={svgRef}
          loading={g.loading}
          error={g.error}
          hasNodes={g.activeNodes.length > 0}
          search={g.search}
          setSearch={g.setSearch}
          coursesWithMaterials={g.coursesWithMaterials}
          selectedCourseId={g.selectedCourseId}
          setSelectedCourseId={g.setSelectedCourseId}
        />

        <div className="space-y-4">
          {g.graph && (
            <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-text-main">Library</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ['Materials', g.graph.stats.materials],
                  ['Concepts', g.graph.stats.concepts],
                  ['Notes', g.graph.stats.notes],
                  ['Quizzes', g.graph.stats.quizzes],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[var(--bg-app)] p-3">
                    <p className="text-xl font-bold tabular-nums text-text-main">{value}</p>
                    <p className="text-xs text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <KnowledgeGraphSidebar
            selected={g.selected}
            gaps={g.gaps}
            showGaps={g.showGaps}
            setShowGaps={g.setShowGaps}
            learningPath={g.learningPath}
            activeNodeCount={g.activeNodes.length}
            activeEdgeCount={g.activeEdges.length}
            onSelectGap={g.selectGap}
            onOpenQuiz={() => g.setQuizModalOpen(true)}
            onOpenConcept={() => g.setConceptModalOpen(true)}
            onOpenNote={() => g.setNoteModalOpen(true)}
          />
        </div>
      </div>

      {g.quizModalOpen && g.selected?.type === 'quiz' && (
        <QuizPreviewModal node={g.selected} onClose={() => g.setQuizModalOpen(false)} />
      )}
      {g.conceptModalOpen && g.selected?.type === 'concept' && (
        <ConceptPreviewModal node={g.selected} onClose={() => g.setConceptModalOpen(false)} />
      )}
      {g.noteModalOpen && g.selected?.type === 'note' && (
        <NotePreviewModal node={g.selected} onClose={() => g.setNoteModalOpen(false)} />
      )}
    </div>
  );
};
