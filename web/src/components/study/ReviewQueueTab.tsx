import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, Brain, CheckCircle2, RotateCcw,
  Play, Trophy, AlertCircle, BookOpen,
  TrendingUp, BarChart2, Clock, Zap,
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
  const { setFlashcards } = useStudy();

  // ── SRS-derived data ──────────────────────────────────────────────
  const dueCards = useMemo(() => {
    const now = new Date();
    return flashcards.filter(f => f.srs && new Date(f.srs.due) <= now);
  }, [flashcards]);

  const newCards = useMemo(() =>
    flashcards.filter(f => !f.srs || f.srs.state === 0),
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

  const sessionCards = useMemo(() => {
    const due = [...dueCards].sort(
      (a, b) => new Date(a.srs!.due).getTime() - new Date(b.srs!.due).getTime(),
    );
    const fill = Math.max(0, MAX_NEW_PER_SESSION - due.length);
    return [...due, ...newCards.slice(0, fill)];
  }, [dueCards, newCards]);

  // ── Session state ─────────────────────────────────────────────────
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionResults, setSessionResults] = useState<Record<string, Rating>>({});

  const currentCard = sessionCards[sessionIndex];
  const goodCount = Object.values(sessionResults).filter(r => r >= 3).length;
  const hardCount = Object.values(sessionResults).filter(r => r <= 2).length;

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
    setSessionIndex(0);
    setFlipped(false);
    setSessionDone(false);
    setSessionResults({});
  }, []);

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
      .filter(f => f.srs && f.srs.reps > 0 && f.srs.state !== 2)
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

  const upcomingReviews = useMemo(() => {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return flashcards.filter(f => {
      if (!f.srs) return false;
      const due = new Date(f.srs.due);
      return due > now && due <= sevenDays;
    }).length;
  }, [flashcards]);

  // ── Render ────────────────────────────────────────────────────────
  const summaryStats = [
    { label: 'Due Today',  value: dueCards.length,    icon: Calendar,     color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
    { label: 'New Cards',  value: newCards.length,    icon: Zap,          color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/30',     border: 'border-blue-200 dark:border-blue-800'   },
    { label: 'Learning',   value: learningCards.length, icon: Brain,      color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800' },
    { label: 'Mastered',   value: masteredCards.length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  ];

  const analyticsStats = [
    { label: 'Retention Rate', value: `${retentionRate}%`, icon: TrendingUp, color: 'text-emerald-500', description: 'Avg recall probability' },
    { label: 'Cards Reviewed', value: reviewedCards.length, icon: BarChart2, color: 'text-blue-500', description: 'Total cards studied' },
    { label: 'Mastered',       value: masteredCards.length, icon: Trophy,    color: 'text-amber-500', description: 'In long-term memory'  },
    { label: 'Upcoming (7d)', value: upcomingReviews,      icon: Clock,     color: 'text-purple-500', description: 'Due in next 7 days'   },
  ];

  return (
    <div className="space-y-8">
      {/* ── Today's Review Summary ─────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-black text-text-main mb-4">Today's Review Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryStats.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className={cn('rounded-2xl border p-4 flex flex-col gap-2', bg, border)}>
              <Icon size={18} className={color} />
              <p className="text-2xl font-black text-text-main">{value}</p>
              <p className="text-xs font-semibold text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Review Session ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-black text-text-main mb-4">Review Session</h2>

        {sessionCards.length === 0 ? (
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
              <p className="text-xl font-black text-text-main">{sessionCards.length} cards ready</p>
              <p className="text-sm text-text-muted mt-1">
                {dueCards.length} due · {sessionCards.length - dueCards.length} new
              </p>
            </div>
            <button
              onClick={() => setSessionStarted(true)}
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
            {/* Progress bar */}
            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-300"
                style={{ width: `${(sessionIndex / sessionCards.length) * 100}%` }}
              />
            </div>
            {/* Session header */}
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
      </section>

      {/* ── Weak Knowledge ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-black text-text-main mb-4">Weak Knowledge</h2>
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
      </section>

      {/* ── Progress Analytics ──────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-black text-text-main mb-4">Progress Analytics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {analyticsStats.map(({ label, value, icon: Icon, color, description }) => (
            <div key={label} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-4 flex flex-col gap-2">
              <Icon size={18} className={color} />
              <p className="text-2xl font-black text-text-main">{value}</p>
              <div>
                <p className="text-xs font-bold text-text-main">{label}</p>
                <p className="text-[10px] text-text-muted">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
