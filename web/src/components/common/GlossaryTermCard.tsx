import React from 'react';
import { Loader2, CheckCircle2, Circle, Pencil, Trash2, Check, X, CheckSquare, Square } from 'lucide-react';
import { CONTENT_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { cn } from '../../utils/cn';
import { GlossaryTerm } from '../../types';

interface GlossaryTermCardProps {
  term: GlossaryTerm;
  isMastered: boolean;
  onToggleMastered: (id: string) => void;
  isTogglingMastered?: boolean;
  onEdit?: (term: GlossaryTerm) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
  isEditing?: boolean;
  editDraft?: { term: string; definition: string };
  onEditDraftChange?: (draft: { term: string; definition: string }) => void;
  isSaving?: boolean;
  onSave?: (id: string) => void;
  onCancelEdit?: () => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const GlossaryTermCard: React.FC<GlossaryTermCardProps> = ({
  term,
  isMastered,
  onToggleMastered,
  isTogglingMastered,
  onEdit,
  onDelete,
  isDeleting,
  isEditing,
  editDraft,
  onEditDraftChange,
  isSaving,
  onSave,
  onCancelEdit,
  isSelected,
  onToggleSelect,
}) => (
  <div
    className={cn(
      'rounded-2xl border p-4 transition-all group',
      isSelected
        ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
        : isMastered
          ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
          : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-primary/30',
    )}
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        {onToggleSelect && !isEditing && (
          <button
            onClick={() => onToggleSelect(term.id)}
            title={isSelected ? 'Deselect term' : 'Select term'}
            className={cn(
              'mt-0.5 shrink-0 transition-all',
              isSelected ? 'text-primary' : 'text-zinc-300 hover:text-primary',
            )}
          >
            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
        )}
        {isEditing && editDraft ? (
          <input
            autoFocus
            value={editDraft.term}
            onChange={e => onEditDraftChange?.({ ...editDraft, term: e.target.value })}
            className="flex-1 rounded-lg border border-primary/50 bg-[var(--bg-app)] px-2 py-1 text-sm font-bold text-text-main outline-none"
          />
        ) : (
          <h3 className="font-bold text-text-main leading-snug">{term.term}</h3>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isEditing && term.sourceName && (
          <span className="flex items-center gap-1 text-[10px] text-text-muted bg-zinc-100 rounded-full px-2 py-0.5">
            {term.sourceKind === 'video'   && <CONTENT_TYPE_ICONS.video.icon   size={9} className="text-red-400"   />}
            {term.sourceKind === 'article' && <CONTENT_TYPE_ICONS.article.icon size={9} className="text-teal-400"  />}
            {term.sourceKind === 'audio'   && <CONTENT_TYPE_ICONS.audio.icon   size={9} className="text-amber-400" />}
            {term.sourceName.slice(0, 18)}{term.sourceName.length > 18 ? '…' : ''}
          </span>
        )}
        {isEditing ? (
          <>
            <button
              onClick={() => onSave?.(term.id)}
              disabled={isSaving || !editDraft?.term.trim() || !editDraft?.definition.trim()}
              title="Save"
              className="rounded-full p-0.5 text-emerald-500 hover:text-emerald-700 disabled:opacity-40 transition-all"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button
              onClick={onCancelEdit}
              title="Cancel"
              className="rounded-full p-0.5 text-zinc-400 hover:text-zinc-600 transition-all"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            {onEdit && (
              <button
                onClick={() => onEdit(term)}
                title="Edit term"
                className="rounded-full p-0.5 text-zinc-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(term.id)}
                disabled={isDeleting}
                title="Delete term"
                className="rounded-full p-0.5 text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            )}
            <button
              onClick={() => onToggleMastered(term.id)}
              disabled={isTogglingMastered}
              title={isMastered ? 'Mark as learning' : 'Mark as mastered'}
              className={cn(
                'rounded-full p-0.5 transition-all disabled:opacity-50',
                isMastered
                  ? 'text-emerald-500 hover:text-emerald-700'
                  : 'text-zinc-300 hover:text-emerald-400',
              )}
            >
              {isTogglingMastered
                ? <Loader2 size={17} className="animate-spin" />
                : isMastered
                  ? <CheckCircle2 size={17} className="fill-emerald-100" />
                  : <Circle size={17} />}
            </button>
          </>
        )}
      </div>
    </div>
    {isEditing && editDraft ? (
      <textarea
        value={editDraft.definition}
        onChange={e => onEditDraftChange?.({ ...editDraft, definition: e.target.value })}
        rows={3}
        className="w-full rounded-lg border border-primary/50 bg-[var(--bg-app)] px-2 py-1.5 text-sm text-text-muted outline-none resize-none"
      />
    ) : (
      <p className="text-sm text-text-muted leading-relaxed">{term.definition}</p>
    )}
  </div>
);
