import React, { useState } from 'react';
import { FolderOpen, Loader2, Tag, X } from 'lucide-react';
import type { LibraryItemTag } from '../../services/libraryService';
import { libraryTagsService, type LibraryItemRef } from '../../services/libraryTagsService';

interface Props {
  itemRef: LibraryItemRef;
  tags: LibraryItemTag[];
  /** Fired after a tag is removed so the page can refetch counts and rows. */
  onRemoved: () => void;
}

const KIND_ICON = { tag: Tag, collection: FolderOpen } as const;

/** The collections/tags an item belongs to, under its card, each removable in place. */
export const LibraryItemTags: React.FC<Props> = ({ itemRef, tags, onRemoved }) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (tags.length === 0) return null;

  const remove = async (tagId: string) => {
    setBusyId(tagId);
    try {
      await libraryTagsService.unassignItems(tagId, [itemRef]);
      onRemoved();
    } catch {
      // Leaving the chip in place is the honest outcome of a failed removal — the next refetch
      // will show whatever the server actually has.
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {tags.map(tag => {
        const Icon = KIND_ICON[tag.kind];
        return (
          <span
            key={tag.libraryTagId}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
            style={tag.color ? { borderColor: `${tag.color}66`, color: tag.color } : undefined}
          >
            <Icon size={9} />
            <span className="max-w-[7rem] truncate">{tag.name}</span>
            <button
              onClick={() => remove(tag.libraryTagId)}
              disabled={busyId !== null}
              aria-label={`Remove from ${tag.name}`}
              className="opacity-60 hover:opacity-100 disabled:opacity-30"
            >
              {busyId === tag.libraryTagId
                ? <Loader2 size={9} className="animate-spin" />
                : <X size={9} />}
            </button>
          </span>
        );
      })}
    </div>
  );
};
