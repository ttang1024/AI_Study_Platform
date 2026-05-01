import React, { useState, useEffect, useRef } from 'react';
import { Tag as TagIcon, X, Plus, Check } from 'lucide-react';
import { Tag, tagService } from '../../services/tagService';
import { cn } from '../../utils/cn';

interface TagManagerProps {
  itemId: string;
  itemType: 'document' | 'video';
  className?: string;
}

export const TagManager: React.FC<TagManagerProps> = ({ itemId, itemType, className }) => {
  const [itemTags, setItemTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const refresh = () => {
    setItemTags(tagService.getTagsForItem(itemId));
    setAllTags(tagService.getAllTags());
  };

  useEffect(() => { refresh(); }, [itemId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggleTag = (tag: Tag) => {
    const has = itemTags.some(t => t.id === tag.id);
    if (has) {
      tagService.removeTagFromItem(itemId, tag.id);
    } else {
      tagService.addTagToItem(itemId, itemType, tag.id);
    }
    refresh();
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    const tag = tagService.createTag(name);
    tagService.addTagToItem(itemId, itemType, tag.id);
    setNewTagName('');
    refresh();
  };

  const handleRemoveTag = (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    e.preventDefault();
    tagService.removeTagFromItem(itemId, tagId);
    refresh();
  };

  return (
    <div className={cn('relative', className)} ref={ref} onClick={e => e.preventDefault()}>
      {/* Tag chips */}
      <div className="flex flex-wrap gap-1 items-center">
        {itemTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={(e) => handleRemoveTag(e, tag.id)}
              className="hover:opacity-70 transition-opacity leading-none"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsOpen(v => !v); }}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] font-bold text-zinc-400 hover:border-primary hover:text-primary transition-all"
        >
          <TagIcon size={9} />
          <Plus size={9} />
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xl p-2 space-y-1">
          {/* Create new */}
          <div className="flex items-center gap-1 px-1">
            <input
              type="text"
              placeholder="New tag name..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateTag(); }}
              className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] px-2 py-1 text-xs outline-none focus:border-primary"
              autoFocus
            />
            <button
              onClick={handleCreateTag}
              className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-white hover:opacity-90"
            >
              <Plus size={12} />
            </button>
          </div>

          {allTags.length > 0 && (
            <div className="border-t border-[var(--border-color)] pt-1 space-y-0.5">
              {allTags.map(tag => {
                const has = itemTags.some(t => t.id === tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleToggleTag(tag)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-zinc-100 transition-all"
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="flex-1 text-left font-medium text-text-main">{tag.name}</span>
                    {has && <Check size={12} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
