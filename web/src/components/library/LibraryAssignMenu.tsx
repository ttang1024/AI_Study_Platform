import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FolderOpen, Loader2, Minus, Plus, Tag } from 'lucide-react';
import {
  libraryTagsService,
  type LibraryItemRef,
  type LibraryTag,
  type LibraryTagKind,
} from '../../services/libraryTagsService';
import { cn } from '../../utils/cn';

/** One entry of the current multi-selection: how to address it, and what it already carries. */
export interface AssignSelectionItem {
  ref: LibraryItemRef;
  tagIds: string[];
}

interface Props {
  selection: AssignSelectionItem[];
  /** Fired after a successful assign/unassign so the caller can refetch and surface the message. */
  onChanged: (message: string) => void;
}

const KIND_ICON = { tag: Tag, collection: FolderOpen } as const;

/**
 * "Add to collection" for the library multi-selection.
 *
 * A row toggles rather than only adding: if every selected item already carries the tag the click
 * removes it, otherwise it adds it to the ones missing it. That way one control covers both
 * endpoints and the checkmark always describes the selection truthfully.
 */
export const LibraryAssignMenu: React.FC<Props> = ({ selection, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<LibraryTagKind>('collection');
  const [creating, setCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await libraryTagsService.getTags();
      setTags(res.data.data);
    } catch {
      setError('Could not load your collections.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetched on open rather than on mount: counts change as the user assigns, and the menu is
  // opened far less often than the library re-renders.
  useEffect(() => { if (open) void load(); }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const refs = selection.map(s => s.ref);

  const toggleTag = async (tag: LibraryTag) => {
    const applied = selection.filter(s => s.tagIds.includes(tag.libraryTagId));
    const removing = applied.length === selection.length;
    // Only the items that would actually change are sent — the server skips no-ops anyway, but
    // this keeps the "Added N items" message matching what the user sees happen.
    const targets = removing
      ? refs
      : selection.filter(s => !s.tagIds.includes(tag.libraryTagId)).map(s => s.ref);

    setBusyId(tag.libraryTagId);
    setError(null);
    try {
      const res = removing
        ? await libraryTagsService.unassignItems(tag.libraryTagId, targets)
        : await libraryTagsService.assignItems(tag.libraryTagId, targets);
      onChanged(res.data.message);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not update that.');
    } finally {
      setBusyId(null);
    }
  };

  const createAndAssign = async () => {
    const name = draftName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const created = await libraryTagsService.createTag({ name, kind: draftKind });
      const res = await libraryTagsService.assignItems(created.data.data.libraryTagId, refs);
      setDraftName('');
      onChanged(res.data.message);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not create that.');
    } finally {
      setCreating(false);
    }
  };

  const collections = tags.filter(t => t.kind === 'collection');
  const plainTags = tags.filter(t => t.kind === 'tag');

  const Row: React.FC<{ tag: LibraryTag }> = ({ tag }) => {
    const Icon = KIND_ICON[tag.kind];
    const applied = selection.filter(s => s.tagIds.includes(tag.libraryTagId)).length;
    const state = applied === 0 ? 'none' : applied === selection.length ? 'all' : 'some';
    return (
      <button
        onClick={() => toggleTag(tag)}
        disabled={busyId !== null}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--primary)]/5 disabled:opacity-50"
      >
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
            state === 'all'
              ? 'border-transparent bg-[var(--primary)] text-white'
              : state === 'some'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-[var(--border-color)]',
          )}
        >
          {busyId === tag.libraryTagId
            ? <Loader2 size={10} className="animate-spin" />
            : state === 'all' ? <Check size={10} />
              : state === 'some' ? <Minus size={10} /> : null}
        </span>
        <Icon size={12} className="shrink-0 text-text-muted" />
        <span className="flex-1 truncate text-text-main">{tag.name}</span>
        <span className="shrink-0 tabular-nums text-[10px] text-text-muted">{tag.itemCount}</span>
      </button>
    );
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        <FolderOpen size={13} />
        Add to collection
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full z-40 mb-2 w-72 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl">
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-text-muted">
                <Loader2 size={12} className="animate-spin" /> Loading…
              </div>
            )}

            {!loading && tags.length === 0 && (
              <p className="px-3 py-3 text-xs text-text-muted">
                No collections or tags yet — create one below.
              </p>
            )}

            {collections.length > 0 && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                Collections
              </p>
            )}
            {collections.map(t => <Row key={t.libraryTagId} tag={t} />)}

            {plainTags.length > 0 && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                Tags
              </p>
            )}
            {plainTags.map(t => <Row key={t.libraryTagId} tag={t} />)}
          </div>

          <div className="border-t border-[var(--border-color)] p-2">
            {error && <p className="px-1 pb-1.5 text-[11px] text-red-600">{error}</p>}
            <div className="flex items-center gap-1.5">
              <select
                value={draftKind}
                onChange={e => setDraftKind(e.target.value as LibraryTagKind)}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 py-1.5 text-[11px]"
              >
                <option value="collection">Collection</option>
                <option value="tag">Tag</option>
              </select>
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void createAndAssign(); }}
                placeholder="New name…"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-[11px]"
              />
              <button
                onClick={createAndAssign}
                disabled={creating || !draftName.trim()}
                title="Create and add the selection to it"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--primary)] px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
