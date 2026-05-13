import React, { useEffect, useState } from 'react';
import { Loader2, NotebookPen, X } from 'lucide-react';
import { KnowledgeGraphNode } from '../../services/knowledgeGraphService';
import { noteService } from '../../services/noteService';
import { Note } from '../../types';

const NOTE_COLOR = '#7c3aed';
const NOTE_BG    = '#ede9fe';

interface Props {
  node: KnowledgeGraphNode;
  onClose: () => void;
}

export const NotePreviewModal: React.FC<Props> = ({ node, onClose }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const noteId = node.id.replace(/^note:/, '');
    let cancelled = false;
    setNote(null);
    setLoading(true);
    noteService.getAllNotes(1, 100)
      .then(({ items }) => {
        if (cancelled) return;
        setNote(items.find(n => n.id === noteId) ?? null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [node.id]);

  return (
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
              style={{ backgroundColor: NOTE_BG, color: NOTE_COLOR }}
            >
              <NotebookPen size={18} />
            </div>
            <div>
              <p className="font-bold text-text-main">{node.title}</p>
              {node.subtitle && <p className="text-xs text-text-muted">{node.subtitle}</p>}
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
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading note…
            </div>
          ) : !note ? (
            <p className="py-8 text-center text-sm text-text-muted">Note content could not be loaded.</p>
          ) : (
            <div
              className="prose prose-sm max-w-none text-text-main"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
