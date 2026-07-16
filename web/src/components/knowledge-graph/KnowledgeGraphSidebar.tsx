import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Network, PlayCircle, TriangleAlert } from 'lucide-react';
import { STUDY_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { KnowledgeGraphNode, ConceptGap, LearningPath } from '../../services/knowledgeGraphService';
import { getNodeStyle, getNodeTarget, nodeStyles, SEVERITY_COLORS } from './graphStyles';

interface Props {
  selected: KnowledgeGraphNode | null;
  gaps: ConceptGap[];
  showGaps: boolean;
  setShowGaps: (fn: (v: boolean) => boolean) => void;
  learningPath: LearningPath | null;
  activeNodeCount: number;
  activeEdgeCount: number;
  onSelectGap: (gap: ConceptGap) => void;
  onOpenQuiz: () => void;
  onOpenConcept: () => void;
  onOpenNote: () => void;
}

export const KnowledgeGraphSidebar: React.FC<Props> = ({
  selected, gaps, showGaps, setShowGaps, learningPath,
  activeNodeCount, activeEdgeCount, onSelectGap, onOpenQuiz, onOpenConcept, onOpenNote,
}) => {
  const selectedStyle = selected ? getNodeStyle(selected.type) : null;
  const SelectedIcon = selectedStyle?.icon ?? Network;

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-text-main">Selected node</p>
        {selected ? (
          <div className="mt-4">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: selectedStyle?.bg, color: selectedStyle?.color }}
              >
                <SelectedIcon size={20} />
              </div>
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-text-main">{selected.title}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{selectedStyle?.label ?? selected.type}</p>
                {selected.subtitle && <p className="mt-2 text-sm text-text-muted">{selected.subtitle}</p>}
              </div>
            </div>
            {selected.type === 'quiz' ? (
              <button
                onClick={onOpenQuiz}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                View Questions
                <STUDY_TYPE_ICONS.quiz.icon size={16} />
              </button>
            ) : selected.type === 'concept' ? (
              <button
                onClick={onOpenConcept}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                View Definition
                <BrainCircuit size={16} />
              </button>
            ) : selected.type === 'note' ? (
              <button
                onClick={onOpenNote}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                View Note
                <STUDY_TYPE_ICONS.notes.icon size={16} />
              </button>
            ) : getNodeTarget(selected) ? (
              <Link
                to={getNodeTarget(selected)!}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Open
                <PlayCircle size={16} />
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-muted">Select a node to inspect it.</p>
        )}
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TriangleAlert size={16} className="text-amber-500" />
            <p className="text-sm font-bold text-text-main">Knowledge gaps</p>
            {gaps.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">{gaps.length}</span>
            )}
          </div>
          {gaps.length > 0 && (
            <button
              onClick={() => setShowGaps(v => !v)}
              className="text-[11px] font-semibold text-[var(--primary)] hover:opacity-75"
            >
              {showGaps ? 'Hide' : 'Show'} on graph
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-text-muted">Concepts referenced but not yet mastered, undefined, or bridging courses.</p>
        {gaps.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No gaps detected — your concepts are well covered.</p>
        ) : (
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {gaps.slice(0, 30).map(gap => (
              <button
                key={gap.id}
                onClick={() => onSelectGap(gap)}
                className="block w-full rounded-xl border border-black/[0.06] p-2.5 text-left transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-app)]"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLORS[gap.severity] }} />
                  <span className="truncate text-[13px] font-semibold text-text-main">{gap.concept}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-muted">{gap.reason}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ArrowRight size={16} className="text-[var(--primary)]" />
          <p className="text-sm font-bold text-text-main">Learning path</p>
          {learningPath && learningPath.totalCount > 0 && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">
              {learningPath.masteredCount}/{learningPath.totalCount}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-text-muted">Your concepts, ordered so prerequisites come first.</p>
        {!learningPath || learningPath.steps.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">Add glossary terms and concept links to build a path.</p>
        ) : (
          <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {learningPath.steps.filter(s => s.status !== 'mastered').slice(0, 20).map(step => (
              <Link
                key={step.termId}
                to={step.url ?? '/glossary'}
                className="block rounded-xl border border-black/[0.06] p-2.5 transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-app)]"
              >
                <div className="flex items-center gap-2">
                  <span className={
                    step.status === 'next'
                      ? 'rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white'
                      : step.status === 'blocked'
                        ? 'rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700'
                        : 'rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500'
                  }>
                    {step.status === 'next' ? 'NEXT' : step.status === 'blocked' ? 'BLOCKED' : 'READY'}
                  </span>
                  <span className="truncate text-[13px] font-semibold text-text-main">{step.concept}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-muted">{step.reason}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-text-main">Visible graph</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[var(--bg-app)] p-3">
            <p className="text-xl font-bold tabular-nums text-text-main">{activeNodeCount}</p>
            <p className="text-xs text-text-muted">Nodes</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-app)] p-3">
            <p className="text-xl font-bold tabular-nums text-text-main">{activeEdgeCount}</p>
            <p className="text-xs text-text-muted">Links</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
        <p className="text-sm font-bold text-text-main">Legend</p>
        <div className="mt-3 space-y-2">
          {Object.entries(nodeStyles).map(([type, style]) => {
            const Icon = style.icon;
            return (
              <div key={type} className="flex items-center gap-2 text-sm text-text-muted">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: style.bg, color: style.color }}>
                  <Icon size={14} />
                </span>
                {style.label}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
