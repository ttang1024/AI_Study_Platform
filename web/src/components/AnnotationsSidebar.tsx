import React from 'react';
import { Trash2 } from 'lucide-react';
import type { DocumentAnnotation } from '../services/annotationsService';

interface Props {
  annotations: DocumentAnnotation[];
  onDelete: (id: string) => void;
}

export const AnnotationsSidebar: React.FC<Props> = ({ annotations, onDelete }) => {
  const sorted = [...annotations].sort((a, b) => a.pageNumber - b.pageNumber);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">
          Annotations ({annotations.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm px-4 text-center">
            <p>No annotations yet.</p>
            <p className="text-xs mt-1">Select text in the document to add one.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorted.map((annotation) => (
              <li
                key={annotation.documentAnnotationId}
                className="px-4 py-3 hover:bg-gray-50 transition-colors"
                style={{ borderLeft: `4px solid ${annotation.color}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      p.{annotation.pageNumber}
                    </span>
                    <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">
                      "{annotation.highlightedText.slice(0, 50)}
                      {annotation.highlightedText.length > 50 ? '…' : ''}"
                    </p>
                    {annotation.note && (
                      <p className="text-xs text-gray-500 mt-1 italic">{annotation.note}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(annotation.documentAnnotationId)}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors mt-0.5"
                    title="Delete annotation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
