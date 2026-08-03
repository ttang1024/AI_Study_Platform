import React, { useCallback, useEffect, useState } from 'react';
import { Bookmark, Check, FolderOpen, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import {
  libraryTagsService,
  parseSavedViewFilters,
  type LibraryTag,
  type LibraryTagKind,
  type SavedLibraryView,
} from '../../services/libraryTagsService';
import { cn } from '../../utils/cn';

interface Props {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  /** Applies a saved view's whole filter set, not just its tags. */
  onApplyView: (filters: ReturnType<typeof parseSavedViewFilters>) => void;
  /** The filters currently in effect, so "save this view" captures what the user is looking at. */
  currentFilters: object;
  /** Bumped by the page after a bulk assign so the item counts on the chips catch up. */
  reloadSignal?: number;
}

const KIND_ICON = { tag: Tag, collection: FolderOpen } as const;

/**
 * The filter strip above the library grid: collections, then tags, then saved views.
 *
 * Collections come first because they are the coarse grouping people organise by, and tags are the
 * cross-cutting labels applied on top — putting them the other way round buries the folders under a
 * long row of chips.
 */
export const LibraryTagBar: React.FC<Props> = ({
  selectedTagIds, onChange, onApplyView, currentFilters, reloadSignal = 0,
}) => {
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [views, setViews] = useState<SavedLibraryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<LibraryTagKind>('collection');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewName, setViewName] = useState('');
  const [savingView, setSavingView] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, v] = await Promise.all([
        libraryTagsService.getTags(),
        libraryTagsService.getViews(),
      ]);
      setTags(t.data.data);
      setViews(v.data.data);
    } catch {
      // A failed tag fetch must not blank the library. The strip simply doesn't render.
      setTags([]); setViews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, reloadSignal]);

  const toggle = (id: string) =>
    onChange(selectedTagIds.includes(id)
      ? selectedTagIds.filter(t => t !== id)
      : [...selectedTagIds, id]);

  const submitDraft = async () => {
    const name = draftName.trim();
    if (!name) return;
    setBusy(true); setError(null);
    try {
      if (editingId) await libraryTagsService.updateTag(editingId, { name });
      else await libraryTagsService.createTag({ name, kind: draftKind });
      setDraftName(''); setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not save that.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true); setError(null);
    try {
      await libraryTagsService.deleteTag(id);
      onChange(selectedTagIds.filter(t => t !== id));
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not delete that.');
    } finally {
      setBusy(false);
    }
  };

  const saveCurrentView = async () => {
    const name = viewName.trim();
    if (!name) return;
    setSavingView(true); setError(null);
    try {
      await libraryTagsService.createView({ name, filtersJson: JSON.stringify(currentFilters) });
      setViewName('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not save that view.');
    } finally {
      setSavingView(false);
    }
  };

  if (loading) return null;

  const collections = tags.filter(t => t.kind === 'collection');
  const plainTags = tags.filter(t => t.kind === 'tag');
  const hasAnything = tags.length > 0 || views.length > 0;

  const Chip: React.FC<{ tag: LibraryTag }> = ({ tag }) => {
    const Icon = KIND_ICON[tag.kind];
    const selected = selectedTagIds.includes(tag.libraryTagId);
    return (
      <button
        onClick={() => toggle(tag.libraryTagId)}
        aria-pressed={selected}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
          selected
            ? 'border-transparent bg-[var(--primary)] text-white'
            : 'border-[var(--border-color)] text-text-muted hover:text-text-main',
        )}
        style={!selected && tag.color ? { borderColor: `${tag.color}66`, color: tag.color } : undefined}
      >
        <Icon size={12} />
        {tag.name}
        <span className={cn('tabular-nums', selected ? 'text-white/70' : 'opacity-60')}>
          {tag.itemCount}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {hasAnything && (
        <div className="flex flex-wrap items-center gap-2">
          {collections.map(t => <Chip key={t.libraryTagId} tag={t} />)}
          {collections.length > 0 && plainTags.length > 0 && (
            <span className="mx-1 h-4 w-px bg-[var(--border-color)]" />
          )}
          {plainTags.map(t => <Chip key={t.libraryTagId} tag={t} />)}

          {views.length > 0 && (
            <>
              <span className="mx-1 h-4 w-px bg-[var(--border-color)]" />
              {views.map(view => (
                <button
                  key={view.savedLibraryViewId}
                  onClick={() => onApplyView(parseSavedViewFilters(view.filtersJson))}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-main"
                >
                  <span aria-hidden>{view.icon ?? '🔖'}</span>
                  {view.name}
                </button>
              ))}
            </>
          )}

          {selectedTagIds.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium text-text-muted hover:text-text-main"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setManaging(m => !m)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-main"
        >
          <Plus size={12} /> {managing ? 'Done' : 'Collections & tags'}
        </button>

        {selectedTagIds.length > 0 && (
          <>
            <span className="h-3 w-px bg-[var(--border-color)]" />
            <input
              value={viewName}
              onChange={e => setViewName(e.target.value)}
              placeholder="Save this filter as…"
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-xs"
            />
            <button
              onClick={saveCurrentView}
              disabled={savingView || !viewName.trim()}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] disabled:opacity-40"
            >
              {savingView ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}
              Save view
            </button>
          </>
        )}
      </div>

      {managing && (
        <div className="space-y-3 rounded-xl border border-[var(--border-color)] p-3">
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {!editingId && (
              <select
                value={draftKind}
                onChange={e => setDraftKind(e.target.value as LibraryTagKind)}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs"
              >
                <option value="collection">Collection</option>
                <option value="tag">Tag</option>
              </select>
            )}
            <input
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void submitDraft(); }}
              placeholder={editingId ? 'New name' : 'Name'}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs"
            />
            <button
              onClick={submitDraft}
              disabled={busy || !draftName.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {editingId ? 'Rename' : 'Create'}
            </button>
            {editingId && (
              <button
                onClick={() => { setEditingId(null); setDraftName(''); }}
                className="text-xs text-text-muted hover:text-text-main"
              >
                Cancel
              </button>
            )}
          </div>

          {tags.length > 0 && (
            <ul className="divide-y divide-[var(--border-color)]">
              {tags.map(tag => {
                const Icon = KIND_ICON[tag.kind];
                return (
                  <li key={tag.libraryTagId} className="flex items-center justify-between gap-3 py-2">
                    <span className="inline-flex min-w-0 items-center gap-2 text-xs text-text-main">
                      <Icon size={12} className="shrink-0 text-text-muted" />
                      <span className="truncate">{tag.name}</span>
                      <span className="shrink-0 text-text-muted">· {tag.itemCount}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => { setEditingId(tag.libraryTagId); setDraftName(tag.name); }}
                        className="rounded p-1 text-text-muted hover:text-text-main"
                        aria-label={`Rename ${tag.name}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => remove(tag.libraryTagId)}
                        className="rounded p-1 text-text-muted hover:text-red-600"
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] text-text-muted">
            Deleting a collection or tag never deletes the items in it.
          </p>
        </div>
      )}
    </div>
  );
};
