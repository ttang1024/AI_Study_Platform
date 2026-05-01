import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, FileText, StickyNote, BrainCircuit, BookMarked, Loader2 } from 'lucide-react';
import { searchService, SearchResultItem } from '../services/searchService';
import { cn } from '../utils/cn';
import { Pagination } from '../components/common/Pagination';

const ENTITY_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'flashcards', label: 'Flashcards', icon: BrainCircuit },
  { id: 'glossary', label: 'Glossary', icon: BookMarked },
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  document: FileText,
  note: StickyNote,
  flashcard: BrainCircuit,
  glossary: BookMarked,
};

const TYPE_COLORS: Record<string, string> = {
  document: 'text-teal-600 bg-teal-50',
  note: 'text-amber-500 bg-amber-50',
  flashcard: 'text-teal-500 bg-teal-50',
  glossary: 'text-emerald-500 bg-emerald-50',
};

const PAGE_SIZE = 20;

export const SearchResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const typeParam = searchParams.get('type') ?? 'all';
  const pageParam = Number(searchParams.get('page') ?? '1');

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(query);

  const selectedTypes = typeParam === 'all' ? undefined : [typeParam];

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setIsLoading(true);
    searchService.search(query, selectedTypes, pageParam, PAGE_SIZE)
      .then(res => {
        setResults(res.items);
        setTotal(res.totalCount);
      })
      .catch(() => { setResults([]); setTotal(0); })
      .finally(() => setIsLoading(false));
  }, [query, typeParam, pageParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue, type: typeParam, page: '1' });
    }
  };

  const setType = (t: string) => {
    setSearchParams({ q: query, type: t, page: '1' });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleItemClick = (item: SearchResultItem) => {
    const url = item.url ?? (item.type === 'document' ? `/documents/${item.id}` : '/library');
    navigate(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Search input */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Search documents, notes, flashcards..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] pl-10 pr-4 py-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      {/* Type filter tabs */}
      {query && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {ENTITY_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5',
                typeParam === t.id
                  ? 'bg-primary text-white'
                  : 'border border-[var(--border-color)] text-text-muted hover:text-text-main hover:border-primary/30'
              )}
            >
              {t.icon && <t.icon size={12} />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {query && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              {total > 0 && (
                <p className="text-xs text-text-muted">
                  Found <span className="font-bold text-text-main">{total}</span> result{total !== 1 ? 's' : ''} for "{query}"
                </p>
              )}

              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <Search size={36} className="text-zinc-300" />
                  <div>
                    <p className="font-bold text-text-main">No results found</p>
                    <p className="text-sm text-text-muted mt-1">Try different keywords or filters.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((item) => {
                    const Icon = TYPE_ICONS[item.type] ?? FileText;
                    const colorClass = TYPE_COLORS[item.type] ?? 'text-zinc-500 bg-zinc-50';
                    const [textColor, bgColor] = colorClass.split(' ');

                    return (
                      <motion.div
                        key={`${item.type}-${item.id}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-4 cursor-pointer hover:border-primary/30 transition-all"
                        onClick={() => handleItemClick(item)}
                      >
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bgColor, textColor)}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-main truncate">{item.title}</p>
                          {item.snippet && (
                            <p className="text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">
                              {item.snippet}
                            </p>
                          )}
                        </div>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', bgColor, textColor)}>
                          {item.type}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              <Pagination
                page={pageParam}
                totalPages={totalPages}
                onPageChange={(p) => setSearchParams({ q: query, type: typeParam, page: String(p) })}
                showPageNumbers={false}
                label={`Page ${pageParam} of ${totalPages}`}
                showPrevNextText
                size="sm"
              />
            </>
          )}
        </>
      )}

      {!query && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <Search size={36} className="text-zinc-300" />
          <p className="text-text-muted">Enter a search query above to get started.</p>
        </div>
      )}
    </motion.div>
  );
};
