import React, { useEffect, useMemo, useState } from 'react';
import {
  WifiOff, Wifi, Download, Loader2, BrainCircuit, BookMarked,
  ChevronLeft, ChevronRight, Search, CheckCircle2, NotebookPen,
} from 'lucide-react';
import type { Flashcard, GlossaryTerm, Note } from '../types';
import { FlashcardFlipCard, getFlashcardCardType } from '../components/study/FlashcardFlipCard';
import { offlineCacheService } from '../services/offlineCacheService';
import { flashcardService } from '../services/flashcardService';
import { glossaryService } from '../services/glossaryService';
import { noteService } from '../services/noteService';

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';

const formatSync = (date: Date | null): string => {
  if (!date) return 'never';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─── Offline flashcard reviewer ──────────────────────────────────────────────────
const OfflineFlashcards: React.FC<{ cards: Flashcard[] }> = ({ cards }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => { setFlipped(false); }, [index]);

  if (cards.length === 0) {
    return <Empty icon={BrainCircuit} label="No flashcards saved offline yet." />;
  }

  const card = cards[index];
  const go = (delta: number) => setIndex(i => (i + delta + cards.length) % cards.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Card {index + 1} of {cards.length}</span>
        {card.documentName && <span className="truncate max-w-[50%]">{card.documentName}</span>}
      </div>
      <FlashcardFlipCard
        front={card.front}
        back={card.back}
        cardType={getFlashcardCardType(card)}
        isFlipped={flipped}
        onFlip={() => setFlipped(f => !f)}
        variant="review"
        hint="Tap to flip"
        className="border-0 bg-white"
        style={{ minHeight: 220, boxShadow: CARD_SHADOW }}
      />
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => go(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-text-muted hover:text-text-main" style={{ boxShadow: CARD_SHADOW }}>
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => setFlipped(f => !f)} className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white">
          {flipped ? 'Show question' : 'Show answer'}
        </button>
        <button onClick={() => go(1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-text-muted hover:text-text-main" style={{ boxShadow: CARD_SHADOW }}>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

// ─── Offline glossary list ───────────────────────────────────────────────────────
const OfflineGlossary: React.FC<{ terms: GlossaryTerm[] }> = ({ terms }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(t => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q));
  }, [terms, search]);

  if (terms.length === 0) {
    return <Empty icon={BookMarked} label="No glossary terms saved offline yet." />;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search terms"
          className="h-10 w-full rounded-xl border border-black/[0.08] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
        />
      </div>
      <div className="space-y-2">
        {filtered.map(term => (
          <div key={term.id} className="rounded-2xl bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            <p className="text-sm font-bold text-text-main">{term.term}</p>
            <p className="mt-1 text-sm text-text-muted">{term.definition}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Offline notes list ──────────────────────────────────────────────────────────
const OfflineNotes: React.FC<{ notes: Note[] }> = ({ notes }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n =>
      n.content.toLowerCase().includes(q) ||
      (n.documentName ?? n.videoName ?? '').toLowerCase().includes(q),
    );
  }, [notes, search]);

  if (notes.length === 0) {
    return <Empty icon={NotebookPen} label="No notes saved offline yet." />;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notes"
          className="h-10 w-full rounded-xl border border-black/[0.08] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
        />
      </div>
      <div className="space-y-2">
        {filtered.map(note => (
          <div key={note.id} className="rounded-2xl bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
            {(note.documentName || note.videoName) && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 truncate">
                {note.documentName ?? note.videoName}
              </p>
            )}
            <div
              className="text-sm text-text-main leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const Empty: React.FC<{ icon: React.ElementType; label: string }> = ({ icon: Icon, label }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Icon size={28} className="text-zinc-300 mb-2" />
    <p className="text-sm text-text-muted">{label}</p>
  </div>
);

// ─── Page ────────────────────────────────────────────────────────────────────────
export const OfflinePage: React.FC = () => {
  const [tab, setTab] = useState<'flashcards' | 'glossary' | 'notes'>('flashcards');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  const loadFromCache = async () => {
    const [c, t, n, s] = await Promise.all([
      offlineCacheService.getCachedFlashcards(),
      offlineCacheService.getCachedGlossary(),
      offlineCacheService.getCachedNotes(),
      offlineCacheService.getLastSync(),
    ]);
    setCards(c);
    setTerms(t);
    setNotes(n);
    setLastSync(s);
  };

  useEffect(() => {
    loadFromCache().finally(() => setLoading(false));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const sync = async () => {
    if (!online) return;
    setSyncing(true);
    try {
      const [paged, , pagedNotes] = await Promise.all([
        flashcardService.getAllFlashcards(1, 1000),
        glossaryService.getAllGlossary(), // caches internally
        noteService.getAllNotes(1, 1000),
      ]);
      await offlineCacheService.cacheFlashcards(paged.items);
      await offlineCacheService.cacheNotes(pagedNotes.items);
      await loadFromCache();
    } catch {
      /* leave existing cache intact on failure */
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-[var(--primary)]" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">Offline study</h1>
          <p className="text-sm text-text-muted mt-1">
            Your saved flashcards, glossary and notes, available without a connection.
          </p>
        </div>
        <button
          onClick={sync}
          disabled={!online || syncing}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {syncing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {syncing ? 'Saving…' : 'Save for offline'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4" style={{ boxShadow: CARD_SHADOW }}>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}`}>
          {online ? <Wifi size={13} /> : <WifiOff size={13} />}
          {online ? 'Online' : 'Offline'}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <CheckCircle2 size={13} className="text-[var(--primary)]" />
          Last saved: {formatSync(lastSync)}
        </span>
        <span className="text-xs text-text-muted">{cards.length} cards · {terms.length} terms · {notes.length} notes cached</span>
      </div>

      <div className="flex items-center gap-1 bg-white rounded-xl p-1 w-fit" style={{ boxShadow: CARD_SHADOW }}>
        {([['flashcards', BrainCircuit, 'Flashcards'], ['glossary', BookMarked, 'Glossary'], ['notes', NotebookPen, 'Notes']] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              tab === key ? 'bg-[var(--primary)] text-white' : 'text-text-muted hover:bg-zinc-100'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'flashcards' && <OfflineFlashcards cards={cards} />}
      {tab === 'glossary' && <OfflineGlossary terms={terms} />}
      {tab === 'notes' && <OfflineNotes notes={notes} />}
    </div>
  );
};
