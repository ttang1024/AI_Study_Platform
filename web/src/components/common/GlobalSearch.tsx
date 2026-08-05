import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Search, FileText, X, Sparkles, Compass } from 'lucide-react';
import { STUDY_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { useNavigate } from 'react-router-dom';
import { useStudy } from '../../context/StudyContext';
import { glossaryService } from '../../services/glossaryService';
import { questionBankService, type QuestionBankQuestion } from '../../services/questionBankService';
import { aiService, type ChatSessionSummary } from '../../services/aiService';
import type { GlossaryTerm } from '../../types';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../i18n';
import { getRecentItems, recordRecentItem, type RecentItem } from '../../services/recentItemsService';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'nav' | 'document' | 'flashcard' | 'note' | 'glossary' | 'quiz' | 'chat';
  href: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Record<SearchResult['type'], React.ReactNode> = {
  nav:      <Compass size={14} />,
  document: <FileText size={14} />,
  flashcard: <STUDY_TYPE_ICONS.flashcard.icon size={14} />,
  note:      <STUDY_TYPE_ICONS.notes.icon     size={14} />,
  glossary:  <STUDY_TYPE_ICONS.glossary.icon  size={14} />,
  quiz:      <STUDY_TYPE_ICONS.quiz.icon      size={14} />,
  chat:      <STUDY_TYPE_ICONS.chat.icon      size={14} />,
};

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  nav: 'Go to',
  document: 'Document',
  flashcard: 'Flashcard',
  note: 'Note',
  glossary: 'Glossary',
  quiz: 'Quiz',
  chat: 'AI Chat',
};

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  nav: 'text-indigo-500',
  document: 'text-teal-600',
  flashcard: 'text-teal-500',
  note: 'text-amber-500',
  glossary: 'text-emerald-500',
  quiz: 'text-green-600',
  chat: 'text-pink-500',
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const { documents, flashcards, allNotes, ensureDocuments, ensureFlashcards, ensureNotes } = useStudy();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [quizzes, setQuizzes] = useState<QuestionBankQuestion[]>([]);
  const [chats, setChats] = useState<ChatSessionSummary[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const extrasLoadedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Re-read on every open (not just on mount) so the last selection shows up
      // immediately the next time the palette is summoned.
      setRecentItems(getRecentItems());
      setTimeout(() => inputRef.current?.focus(), 50);
      // The document list, flashcard deck and recent notes are loaded lazily by
      // StudyContext — make them searchable the first time search opens.
      void ensureDocuments();
      void ensureFlashcards();
      void ensureNotes();
      // Glossary terms, quiz questions and chat sessions aren't kept in
      // StudyContext (only counts are), so fetch them lazily the first time
      // search is opened.
      if (!extrasLoadedRef.current) {
        extrasLoadedRef.current = true;
        glossaryService.getAllGlossary().then(setGlossary).catch(() => {});
        questionBankService.getQuestions().then(setQuizzes).catch(() => {});
        aiService.getChatSessions().then(setChats).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // "Go to page" commands — labels resolve through i18n so they match the sidebar.
  const navCommands: SearchResult[] = React.useMemo(() => {
    const cmd = (id: string, title: string, href: string): SearchResult => ({ id, title, type: 'nav', href });
    return [
      cmd('nav-dashboard', t('nav.dashboard'), '/dashboard'),
      cmd('nav-library', t('nav.library'), '/library'),
      cmd('nav-summarizer', t('nav.summarizer'), '/library/add'),
      cmd('nav-flashcards', t('nav.flashcards'), '/flashcards'),
      cmd('nav-review', `${t('nav.flashcards')} · Review Queue`, '/flashcards?tab=review'),
      cmd('nav-leeches', `${t('nav.flashcards')} · Leeches`, '/flashcards?tab=leeches'),
      cmd('nav-practice', t('nav.practiceCenter'), '/quizzes'),
      cmd('nav-planner', `${t('nav.practiceCenter')} · ${t('nav.planner')}`, '/quizzes?tab=planner'),
      cmd('nav-materials', t('nav.materials'), '/materials'),
      cmd('nav-notes', `${t('nav.materials')} · ${t('nav.notes')}`, '/materials?tab=notes'),
      cmd('nav-glossary', `${t('nav.materials')} · ${t('nav.glossary')}`, '/materials?tab=glossary'),
      cmd('nav-tools', t('nav.tools'), '/tools'),
      cmd('nav-insights', t('nav.insights'), '/insights'),
      cmd('nav-graph', `${t('nav.insights')} · ${t('nav.knowledgeGraph')}`, '/insights?tab=graph'),
      cmd('nav-chat', t('nav.chat'), '/chat'),
      cmd('nav-spaces', t('nav.spaces'), '/spaces'),
      cmd('nav-settings', t('nav.settings'), '/settings'),
    ];
  }, [t]);

  const recentResults: SearchResult[] = React.useMemo(() =>
    recentItems.map(r => ({ id: r.id, title: r.title, subtitle: r.subtitle, type: r.type, href: r.href })),
    [recentItems]);

  const results: SearchResult[] = React.useMemo(() => {
    // No query: recents (what you were just doing) come first, then the full nav map —
    // the palette works as pure navigation with every page one Enter away.
    if (!query.trim()) return [...recentResults, ...navCommands];

    const q = query.toLowerCase().trim();
    const results: SearchResult[] = navCommands.filter(c => c.title.toLowerCase().includes(q));
    if (query.length < 2) return results;

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
          href: '/materials?tab=notes',
        });
      }
    }

    for (const term of glossary) {
      if (term.term.toLowerCase().includes(q) || term.definition.toLowerCase().includes(q)) {
        results.push({
          id: term.id,
          title: term.term,
          subtitle: term.definition,
          type: 'glossary',
          href: '/materials?tab=glossary',
        });
      }
    }

    for (const quiz of quizzes) {
      const hay = `${quiz.question} ${quiz.correctAnswer} ${quiz.explanation} ${quiz.options.join(' ')}`.toLowerCase();
      if (hay.includes(q)) {
        results.push({
          id: quiz.quizId,
          title: quiz.question,
          subtitle: quiz.correctAnswer,
          type: 'quiz',
          href: '/quizzes',
        });
      }
    }

    for (const chat of chats) {
      if (chat.sourceName.toLowerCase().includes(q) || chat.lastMessage.toLowerCase().includes(q)) {
        results.push({
          id: chat.conversationId,
          title: chat.sourceName,
          subtitle: chat.lastMessage,
          type: 'chat',
          href: '/chat',
        });
      }
    }

    return results.slice(0, 12);
  }, [query, navCommands, recentResults, documents, flashcards, allNotes, glossary, quizzes, chats]);

  // Section headers for the empty-query view only — a query narrows everything into one
  // ranked list, so grouping stops being meaningful once the user is actually searching.
  const sectionAt = React.useMemo(() => {
    if (query.trim()) return new Map<number, string>();
    const map = new Map<number, string>();
    if (recentResults.length > 0) map.set(0, 'Recent');
    map.set(recentResults.length, 'Go to page');
    return map;
  }, [query, recentResults.length]);

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.type !== 'nav') {
      recordRecentItem({ id: result.id, title: result.title, subtitle: result.subtitle, type: result.type, href: result.href });
    }
    navigate(result.href);
    onClose();
  }, [navigate, onClose]);

  // This palette only matches text it already has in memory. Handing the query to the server search
  // page is what reaches everything else: transcripts, semantic matches, and the AI answer.
  const canSearchEverything = query.trim().length >= 2;

  const handleSearchEverything = useCallback(() => {
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    onClose();
  }, [navigate, query, onClose]);

  // Sits after the results as one more selectable row, so Enter reaches it with no local matches.
  const everythingIndex = results.length;
  const selectableCount = results.length + (canSearchEverything ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, selectableCount - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      if (results[activeIndex]) handleSelect(results[activeIndex]);
      else if (canSearchEverything && activeIndex === everythingIndex) handleSearchEverything();
    }
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
            placeholder="Search documents, flashcards, quizzes, notes, glossary, chats..."
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
                {sectionAt.has(i) && (
                  <p className={cn(
                    'px-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted',
                    i > 0 && 'pt-3',
                  )}>
                    {sectionAt.get(i)}
                  </p>
                )}
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
          <div className="px-4 pt-8 pb-4 text-center text-sm text-text-muted">Nothing loaded here matches "{query}"</div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-text-muted">Type to search...</div>
        )}

        {/* Escape hatch to the server-backed search page */}
        {canSearchEverything && (
          <button
            onClick={handleSearchEverything}
            onMouseEnter={() => setActiveIndex(everythingIndex)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-[var(--border-color)] transition-colors',
              activeIndex === everythingIndex ? 'bg-primary/10' : 'hover:bg-[var(--bg-app)]',
            )}
          >
            <Sparkles size={14} className="shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-main truncate">
                Search everything for "{query.trim()}"
              </p>
              <p className="text-xs text-text-muted">Full library search, or let AI answer from your sources</p>
            </div>
          </button>
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
