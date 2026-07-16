import React, { useRef } from 'react';
import { QuizPreviewModal } from '../components/quiz/QuizPreviewModal';
import { ConceptPreviewModal } from '../components/knowledge-graph/ConceptPreviewModal';
import { NotePreviewModal } from '../components/knowledge-graph/NotePreviewModal';
import { GraphCanvas } from '../components/knowledge-graph/GraphCanvas';
import { KnowledgeGraphSidebar } from '../components/knowledge-graph/KnowledgeGraphSidebar';
import { useGraphSimulation } from '../components/knowledge-graph/useGraphSimulation';
import { useKnowledgeGraph } from './knowledgeGraph/useKnowledgeGraph';

export const KnowledgeGraphPage: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const g = useKnowledgeGraph();

  useGraphSimulation(svgRef, wrapperRef, g.filtered, g.gapById, g.showGaps, g.setSelected);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-2 text-4xl font-black text-text-main">
            Cross-material <span className="text-emerald-600">Concept Map</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Connect concepts, notes, quizzes, flashcards, and materials across courses.
          </p>
        </div>
        {g.graph && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Materials', g.graph.stats.materials],
              ['Concepts', g.graph.stats.concepts],
              ['Notes', g.graph.stats.notes],
              ['Quizzes', g.graph.stats.quizzes],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-right shadow-sm">
                <p className="text-lg font-bold tabular-nums text-text-main">{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

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
