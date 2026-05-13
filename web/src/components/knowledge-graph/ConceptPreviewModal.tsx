import React from 'react';
import { BrainCircuit, X } from 'lucide-react';
import { KnowledgeGraphNode } from '../../services/knowledgeGraphService';

const CONCEPT_COLOR = '#0d9488';
const CONCEPT_BG    = '#ccfbf1';

interface Props {
  node: KnowledgeGraphNode;
  onClose: () => void;
}

export const ConceptPreviewModal: React.FC<Props> = ({ node, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
    onClick={onClose}
  >
    <div
      className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      style={{ maxHeight: '82vh' }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-start justify-between border-b border-black/[0.06] p-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: CONCEPT_BG, color: CONCEPT_COLOR }}
          >
            <BrainCircuit size={18} />
          </div>
          <div>
            <p className="font-bold text-text-main">{node.title}</p>
            <p className="text-xs text-text-muted">Concept</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-4 rounded-lg p-1.5 text-text-muted hover:bg-[var(--bg-app)]"
        >
          <X size={18} />
        </button>
      </div>

      <div className="overflow-y-auto p-5">
        {node.description ? (
          <div className="rounded-xl border border-black/[0.06] p-4">
            <p className="text-sm leading-relaxed text-text-main">{node.description}</p>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">
            No glossary definition for this concept. It was extracted from a mind map.
          </p>
        )}
      </div>
    </div>
  </div>
);
