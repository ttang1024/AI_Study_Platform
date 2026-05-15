import React, { useState, useRef, useEffect } from 'react';
import { X, Tag, BookOpen, BarChart2, Plus, Check, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Flashcard } from '../../types';

interface FlashcardClassifyModalProps {
  card: Flashcard;
  allTags: string[];
  allChapters: string[];
  onSave: (data: { front: string; back: string; difficulty: 'easy' | 'medium' | 'hard'; chapter: string; tags: string[] }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const DIFFICULTIES = [
  { value: 'easy' as const, label: 'Easy', color: 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200' },
  { value: 'medium' as const, label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' },
  { value: 'hard' as const, label: 'Hard', color: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200' },
] as const;

export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  hard: 'bg-red-100 text-red-700 border-red-200',
};

export const FlashcardClassifyModal: React.FC<FlashcardClassifyModalProps> = ({
  card, allTags, allChapters, onSave, onDelete, onClose,
}) => {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(card.difficulty);
  const [chapter, setChapter] = useState(card.chapter ?? '');
  const [tags, setTags] = useState<string[]>(card.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [chapterOpen, setChapterOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const filteredChapters = allChapters.filter(
    c => c.toLowerCase().includes(chapter.toLowerCase()) && c !== chapter,
  );
  const filteredTags = allTags.filter(
    t => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t),
  );

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase();
    if (clean && !tags.includes(clean)) setTags(prev => [...prev, clean]);
    setTagInput('');
    tagInputRef.current?.focus();
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    try {
      await onSave({ front: front.trim(), back: back.trim(), difficulty, chapter: chapter.trim(), tags });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-chapter-dropdown]')) setChapterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-app)] border border-[var(--border-color)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] shrink-0">
          <h3 className="font-black text-text-main text-lg">Edit Card</h3>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                  confirmDelete
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'text-red-500 hover:bg-red-50 border border-red-200',
                )}
              >
                <Trash2 size={13} />
                {deleting ? 'Deleting…' : confirmDelete ? 'Confirm Delete' : 'Delete'}
              </button>
            )}
            <button
              onClick={() => { setConfirmDelete(false); onClose(); }}
              className="rounded-lg p-1.5 hover:bg-zinc-100 text-zinc-500"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Front */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-2">
              Front
            </label>
            <textarea
              value={front}
              onChange={e => setFront(e.target.value)}
              rows={3}
              placeholder="Front of card…"
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm resize-y outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>

          {/* Back */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-text-muted mb-2">
              Back
            </label>
            <textarea
              value={back}
              onChange={e => setBack(e.target.value)}
              rows={4}
              placeholder="Back of card…"
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm resize-y outline-none focus:border-[var(--primary)] transition-colors"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted mb-2">
              <BarChart2 size={13} /> Difficulty
            </label>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={cn(
                    'flex-1 rounded-xl border-2 py-2 text-sm font-black transition-all',
                    d.color,
                    difficulty === d.value && 'ring-2 ring-offset-1 ring-current scale-[1.03]',
                  )}
                >
                  {difficulty === d.value && <Check size={12} className="inline mr-1" />}
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chapter */}
          <div data-chapter-dropdown>
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted mb-2">
              <BookOpen size={13} /> Chapter
            </label>
            <div className="relative">
              <input
                value={chapter}
                onChange={e => { setChapter(e.target.value); setChapterOpen(true); }}
                onFocus={() => setChapterOpen(true)}
                placeholder="e.g. Chapter 3, Unit 2…"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] transition-colors"
              />
              {chapterOpen && filteredChapters.length > 0 && (
                <ul className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                  {filteredChapters.map(c => (
                    <li key={c}>
                      <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-sidebar)] text-text-main"
                        onMouseDown={() => { setChapter(c); setChapterOpen(false); }}
                      >
                        {c}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted mb-2">
              <Tag size={13} /> Tags
            </label>
            <div className="min-h-[42px] flex flex-wrap gap-1.5 items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 focus-within:border-[var(--primary)] transition-colors">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-bold text-[var(--primary)]">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? 'Add tags… (Enter or comma to add)' : ''}
                className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-text-muted"
              />
            </div>
            {tagInput && filteredTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filteredTags.map(t => (
                  <button
                    key={t}
                    onClick={() => addTag(t)}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors"
                  >
                    <Plus size={10} /> {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-2 shrink-0 border-t border-[var(--border-color)]">
          <button
            onClick={() => { setConfirmDelete(false); onClose(); }}
            className="flex-1 rounded-2xl border border-[var(--border-color)] py-3 text-sm font-bold text-text-muted hover:bg-[var(--bg-sidebar)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !front.trim() || !back.trim()}
            className="flex-1 rounded-2xl bg-[var(--primary)] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
