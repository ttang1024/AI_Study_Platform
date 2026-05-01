import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Search, FileText, BrainCircuit, StickyNote, BookMarked, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStudy } from '../../context/StudyContext';
import { cn } from '../../utils/cn';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'document' | 'flashcard' | 'note' | 'glossary';
  href: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Record<SearchResult['type'], React.ReactNode> = {
  document: <FileText size={14} />,
  flashcard: <BrainCircuit size={14} />,
  note: <StickyNote size={14} />,
  glossary: <BookMarked size={14} />,
};

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  document: 'Document',
  flashcard: 'Flashcard',
  note: 'Note',
  glossary: 'Glossary',
};

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  document: 'text-teal-600',
  flashcard: 'text-teal-500',
  note: 'text-amber-500',
  glossary: 'text-emerald-500',
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const { documents, flashcards, allNotes } = useStudy();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results: SearchResult[] = React.useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const doc of documents) {
      if (doc.name.toLowerCase().includes(q) || doc.summary?.toLowerCase().includes(q)) {
        results.push({ id: doc.id, title: doc.name, type: 'document', href: `/documents/${doc.id}` });
      }
    }

    for (const fc of flashcards) {
      if (fc.front.toLowerCase().includes(q) || fc.back.toLowerCase().includes(q)) {
        results.push({
          id: fc.id,
          title: fc.front,
          subtitle: fc.back,
          type: 'flashcard',
          href: '/flashcards',
        });
      }
    }

    for (const note of allNotes) {
      if (note.content.toLowerCase().includes(q)) {
        const preview = note.content.replace(/<[^>]+>/g, '').substring(0, 80);
        results.push({
          id: note.id,
          title: note.documentName ?? note.videoName ?? 'Note',
          subtitle: preview,
          type: 'note',
          href: '/notes',
        });
      }
    }

    return results.slice(0, 12);
  }, [query, documents, flashcards, allNotes]);

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(result.href);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIndex]) { handleSelect(results[activeIndex]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search documents, flashcards, notes..."
            className="flex-1 bg-transparent text-sm text-text-main placeholder:text-text-muted outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-text-muted hover:text-text-main">
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => (
              <li key={r.id + r.type}>
                <button
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
                    i === activeIndex ? 'bg-primary/10' : 'hover:bg-[var(--bg-app)]',
                  )}
                >
                  <span className={cn('mt-0.5 shrink-0', TYPE_COLORS[r.type])}>{TYPE_ICONS[r.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-main truncate">{r.title}</p>
                    {r.subtitle && <p className="text-xs text-text-muted truncate">{r.subtitle}</p>}
                  </div>
                  <span className={cn('text-[10px] font-bold uppercase shrink-0 mt-0.5', TYPE_COLORS[r.type])}>
                    {TYPE_LABELS[r.type]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : query.length >= 2 ? (
          <div className="px-4 py-8 text-center text-sm text-text-muted">No results for "{query}"</div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-text-muted">Type to search...</div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border-color)] flex items-center gap-4 text-[10px] text-text-muted">
          <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">ESC</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};
