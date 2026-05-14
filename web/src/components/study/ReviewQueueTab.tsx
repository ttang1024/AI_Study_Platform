import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Brain, CheckCircle2, RotateCcw,
  Play, Trophy, AlertCircle, BookOpen,
  TrendingUp, Zap,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Flashcard } from '../../types';
import { flashcardService } from '../../services/flashcardService';
import { useStudy } from '../../context/StudyContext';
import { FlashcardSessionCard, SessionRating } from './FlashcardSessionCard';

interface Props {
  flashcards: Flashcard[];
}

type Rating = SessionRating;

const MAX_NEW_PER_SESSION = 20;

// ── Weak-section sub-component ────────────────────────────────────────────────
interface WeakSectionProps {
  title: string;
  icon: React.FC<{ size?: number; className?: string }>;
  iconClass: string;
  items: Flashcard[];
  labelFn?: (f: Flashcard) => string;
  empty: string;
}

const WeakSection: React.FC<WeakSectionProps> = ({ title, icon: Icon, iconClass, items, labelFn, empty }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className={iconClass} />
        <p className="text-sm font-black text-text-main">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map(f => (
            <div
              key={f.id}
              onClick={() => setExpandedId(prev => prev === f.id ? null : f.id)}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] p-3 cursor-pointer hover:border-[var(--primary)]/30 transition-colors"
            >
              <p className="text-xs font-semibold text-text-main line-clamp-2">{f.front}</p>
              {labelFn && <p className={cn('text-[10px] font-bold mt-1', iconClass)}>{labelFn(f)}</p>}
              <AnimatePresence>
                {expandedId === f.id && (
                  <motion.p
                    key="back"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-text-muted mt-2 pt-2 border-t border-[var(--border-color)] overflow-hidden"
                  >
                    {f.back}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export const ReviewQueueTab: React.FC<Props> = ({ flashcards }) => {
  const { setFlashcards, refreshFlashcards } = useStudy();

  // ── SRS-derived data ──────────────────────────────────────────────
  const dueCards = useMemo(() => {
    const todayUTC = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    return flashcards.filter(f => f.srs && f.srs.due.slice(0, 10) <= todayUTC);
  }, [flashcards]);

  const newCards = useMemo(() =>
    flashcards.filter(f => !f.srs),
    [flashcards],
  );

  const learningCards = useMemo(() =>
    flashcards.filter(f => f.srs && (f.srs.state === 1 || f.srs.state === 3)),
    [flashcards],
  );

  const masteredCards = useMemo(() =>
    flashcards.filter(f => f.srs && f.srs.state === 2),
    [flashcards],
  );

  // Pre-session candidate list (live, used for the "start" panel counts)
  const candidateCards = useMemo(() => {
    const due = [...dueCards].sort(
      (a, b) => new Date(a.srs!.due).getTime() - new Date(b.srs!.due).getTime(),
    );
    const fill = Math.max(0, MAX_NEW_PER_SESSION - due.length);
    return [...due, ...newCards.slice(0, fill)];
  }, [dueCards, newCards]);

  // ── Session state ─────────────────────────────────────────────────
  const [sessionStarted, setSessionStarted] = useState(false);
  // Session cards are locked at start so ratings don't shift the card list mid-session
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionResults, setSessionResults] = useState<Record<string, Rating>>({});

  const currentCard = sessionCards[sessionIndex];
  const goodCount = Object.values(sessionResults).filter(r => r >= 3).length;
  const hardCount = Object.values(sessionResults).filter(r => r <= 2).length;

  const startSession = useCallback(() => {
    setSessionCards(candidateCards);
    setSessionStarted(true);
  }, [candidateCards]);

  const rate = useCallback(async (rating: Rating) => {
    if (!currentCard || submitting) return;
    setSubmitting(true);
    const newDifficulty = rating === 4 ? 'easy' : rating === 3 ? 'medium' : 'hard';
    const [reviewResult] = await Promise.allSettled([
      flashcardService.reviewFlashcard(currentCard.id, rating),
      flashcardService.classifyFlashcard(currentCard.id, { difficulty: newDifficulty }),
    ]);
    if (reviewResult.status === 'fulfilled') {
      const newSrs = reviewResult.value.srs;
      setFlashcards(prev => prev.map(f =>
        f.id === currentCard.id ? { ...f, difficulty: newDifficulty, srs: newSrs } : f,
      ));
    } else {
      setFlashcards(prev => prev.map(f =>
        f.id === currentCard.id ? { ...f, difficulty: newDifficulty } : f,
      ));
    }
    setSessionResults(prev => ({ ...prev, [currentCard.id]: rating }));
    setSubmitting(false);
    setFlipped(false);
    if (sessionIndex + 1 >= sessionCards.length) {
      setSessionDone(true);
    } else {
      setSessionIndex(i => i + 1);
    }
  }, [currentCard, submitting, sessionIndex, sessionCards.length, setFlashcards]);

  const resetSession = useCallback(() => {
    setSessionStarted(false);
    setSessionCards([]);
    setSessionIndex(0);
    setFlipped(false);
    setSessionDone(false);
    setSessionResults({});
    void refreshFlashcards();
  }, [refreshFlashcards]);

  // ── Weak Knowledge ────────────────────────────────────────────────
  const hardFlashcards = useMemo(() =>
    flashcards.filter(f => f.difficulty === 'hard').slice(0, 5),
    [flashcards],
  );

  const repeatedMistakes = useMemo(() =>
    flashcards
      .filter(f => f.srs && f.srs.lapses > 0)
      .sort((a, b) => b.srs!.lapses - a.srs!.lapses)
      .slice(0, 5),
    [flashcards],
  );

  const unmasteredConcepts = useMemo(() =>
    flashcards
      .filter(f => f.srs && f.srs.state === 1)
      .sort((a, b) => a.srs!.retrievability - b.srs!.retrievability)
      .slice(0, 5),
    [flashcards],
  );

  // ── Analytics ─────────────────────────────────────────────────────
  const reviewedCards = useMemo(() => flashcards.filter(f => f.srs && f.srs.reps > 0), [flashcards]);

  const retentionRate = useMemo(() => {
    if (reviewedCards.length === 0) return 0;
    const avg = reviewedCards.reduce((sum, f) => sum + (f.srs?.retrievability ?? 0), 0) / reviewedCards.length;
    return Math.round(avg * 100);
  }, [reviewedCards]);

  const statStrip = [
    { icon: Calendar,     color: 'text-orange-500', value: dueCards.length,      label: 'due'      },
    { icon: Zap,          color: 'text-blue-500',   value: newCards.length,       label: 'new'      },
    { icon: Brain,        color: 'text-purple-500', value: learningCards.length,  label: 'learning' },
    { icon: CheckCircle2, color: 'text-emerald-500',value: masteredCards.length,  label: 'mastered' },
    ...(reviewedCards.length > 0
      ? [{ icon: TrendingUp, color: 'text-teal-500', value: `${retentionRate}%`, label: 'retention' }]
      : []),
  ];

  const hasInsights =
    hardFlashcards.length > 0 || repeatedMistakes.length > 0 || unmasteredConcepts.length > 0;

  return (
    <div className="space-y-5">
      {/* ── Compact stat strip ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] px-5 py-3">
        {statStrip.map(({ icon: Icon, color, value, label }, i) => (
          <React.Fragment key={label}>
            {i > 0 && <span className="text-zinc-300 dark:text-zinc-600 select-none text-xs">·</span>}
            <div className="flex items-center gap-1.5">
              <Icon size={13} className={color} />
              <span className="text-sm font-black text-text-main">{value}</span>
              <span className="text-xs text-text-muted">{label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* ── Review Session ─────────────────────────────────────────── */}
      {candidateCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-sidebar)] p-10 flex flex-col items-center text-center">
          <CheckCircle2 size={36} className="text-emerald-400 mb-3" />
          <p className="font-bold text-text-main">All caught up!</p>
          <p className="text-sm text-text-muted mt-1">No cards are due right now. Check back later.</p>
        </div>
      ) : !sessionStarted ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-8 flex flex-col items-center text-center gap-4">
          <div className="rounded-2xl bg-[var(--primary)]/10 p-5">
            <Brain size={36} className="text-[var(--primary)]" />
          </div>
          <div>
            <p className="text-xl font-black text-text-main">{candidateCards.length} cards ready</p>
            <p className="text-sm text-text-muted mt-1">
              {dueCards.length} due · {candidateCards.length - dueCards.length} new
            </p>
          </div>
          <button
            onClick={startSession}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
          >
            <Play size={16} /> Start Review
          </button>
        </div>
      ) : sessionDone ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-8 flex flex-col items-center text-center gap-4">
          <Trophy
            size={44}
            className={cn(
              goodCount / sessionCards.length >= 0.8 ? 'text-emerald-500' :
              goodCount / sessionCards.length >= 0.5 ? 'text-amber-500' : 'text-red-500',
            )}
          />
          <p className="text-4xl font-black text-text-main">
            {Math.round((goodCount / sessionCards.length) * 100)}%
          </p>
          <p className="text-text-muted">{goodCount} good · {hardCount} need review</p>
          <button
            onClick={resetSession}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-bold text-text-muted hover:border-[var(--primary)]/50 transition-colors"
          >
            <RotateCcw size={15} /> Done
          </button>
        </div>
      ) : currentCard ? (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] overflow-hidden">
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300"
              style={{ width: `${(sessionIndex / sessionCards.length) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-color)]">
            <span className="text-xs font-bold text-text-muted">{sessionIndex + 1} / {sessionCards.length}</span>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-emerald-500">{goodCount}✓</span>
              <span className="text-red-500">{hardCount}✗</span>
            </div>
          </div>
          <FlashcardSessionCard
            card={currentCard}
            flipped={flipped}
            onFlip={() => setFlipped(f => !f)}
            onRate={(r) => void rate(r)}
            submitting={submitting}
          />
        </div>
      ) : null}

      {/* ── Weak Knowledge ──────────────────────────────────────────── */}
      {hasInsights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WeakSection
            title="Hard Flashcards"
            icon={AlertCircle}
            iconClass="text-red-500"
            items={hardFlashcards}
            empty="No hard cards right now."
          />
          <WeakSection
            title="Repeated Mistakes"
            icon={RotateCcw}
            iconClass="text-orange-500"
            items={repeatedMistakes}
            labelFn={(f) => f.srs ? `${f.srs.lapses} lapse${f.srs.lapses !== 1 ? 's' : ''}` : ''}
            empty="No repeated mistakes yet."
          />
          <WeakSection
            title="Unmastered Concepts"
            icon={BookOpen}
            iconClass="text-purple-500"
            items={unmasteredConcepts}
            labelFn={(f) => f.srs ? `${Math.round(f.srs.retrievability * 100)}% recall` : ''}
            empty="All reviewed cards are on track!"
          />
        </div>
      )}
    </div>
  );
};
