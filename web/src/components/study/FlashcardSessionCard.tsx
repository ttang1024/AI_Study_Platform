import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, RotateCcw, Trophy, X, Pencil, Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Flashcard } from '../../types';
import { useStudy } from '../../context/StudyContext';
import { flashcardService } from '../../services/flashcardService';
import { FlashcardCardType, FlashcardFlipCard, getFlashcardCardType } from './FlashcardFlipCard';

export type SessionRating = 1 | 2 | 3 | 4;

export const SESSION_RATINGS: { rating: SessionRating; label: string; color: string; border: string; bg: string }[] = [
  { rating: 1, label: 'Again', color: 'text-red-600', border: 'border-red-300', bg: 'bg-red-50 dark:bg-red-950/30' },
  { rating: 2, label: 'Hard', color: 'text-orange-500', border: 'border-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  { rating: 3, label: 'Good', color: 'text-green-600', border: 'border-green-300', bg: 'bg-green-50 dark:bg-green-950/30' },
  { rating: 4, label: 'Easy', color: 'text-blue-600', border: 'border-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/30' },
];

interface FlashcardSessionCardProps {
  card: Pick<Flashcard, 'id' | 'front' | 'back'> & Pick<Partial<Flashcard>, 'imageUrl' | 'occlusions'> & { cardType?: FlashcardCardType };
  flipped: boolean;
  onFlip: () => void;
  onRate: (rating: SessionRating) => void;
  submitting?: boolean;
}

const RatingControls: React.FC<{
  onRate: (rating: SessionRating) => void;
  submitting?: boolean;
  buttonClassName?: string;
}> = ({ onRate, submitting = false, buttonClassName }) => (
  <>
    <p className="text-center text-[10px] font-black uppercase tracking-widest text-text-muted">
      How well did you remember?
    </p>
    <div className="grid grid-cols-4 gap-2">
      {SESSION_RATINGS.map(({ rating, label, color, border, bg }) => (
        <button
          key={rating}
          onClick={() => onRate(rating)}
          disabled={submitting}
          className={cn(
            buttonClassName ?? 'flex items-center justify-center rounded-2xl border-2 py-3 text-xs font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-60',
            bg, border, color,
          )}
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : label}
        </button>
      ))}
    </div>
    <div className="flex justify-between px-1 text-[10px] text-text-muted">
      <span>Complete blackout</span>
      <span>Perfect recall</span>
    </div>
  </>
);

export const FlashcardSessionCard: React.FC<FlashcardSessionCardProps> = ({
  card,
  flipped,
  onFlip,
  onRate,
  submitting = false,
}) => (
  <div className="p-6">
    <AnimatePresence mode="wait">
      <motion.div
        key={card.id + (flipped ? '-back' : '-front')}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <FlashcardFlipCard
          front={card.front}
          back={card.back}
          cardType={card.cardType}
          imageUrl={card.imageUrl}
          occlusions={card.occlusions}
          isFlipped={flipped}
          onFlip={onFlip}
          variant="review"
        />
      </motion.div>
    </AnimatePresence>

    <AnimatePresence>
      {flipped && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 space-y-2 overflow-hidden"
        >
          <RatingControls onRate={onRate} submitting={submitting} />
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

interface SessionDeckCard {
  id: string;
  front: string;
  back: string;
  cardType?: FlashcardCardType;
  imageUrl?: string;
  occlusions?: Flashcard['occlusions'];
}

interface FlashcardSessionDeckProps {
  cards: SessionDeckCard[];
  title: string;
  onClose?: () => void;
  variant?: 'modal' | 'inline';
}

interface RatingResult {
  rating: SessionRating;
  scheduledDays: number;
}

const ratingToDifficulty = (r: SessionRating): 'easy' | 'medium' | 'hard' =>
  r === 4 ? 'easy' : r === 3 ? 'medium' : 'hard';

export const FlashcardSessionDeck: React.FC<FlashcardSessionDeckProps> = ({
  cards,
  title,
  onClose,
  variant = 'modal',
}) => {
  const { setFlashcards } = useStudy();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, RatingResult>>({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Local front/back overrides so edits show immediately even when `cards` is a
  // prop the deck doesn't own (e.g. video detail's externalCards).
  const [edits, setEdits] = useState<Record<string, { front: string; back: string }>>({});
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({ front: '', back: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const rawCurrent = cards[index];
  const current = rawCurrent ? { ...rawCurrent, ...edits[rawCurrent.id] } : rawCurrent;

  const startEditing = () => {
    if (!current) return;
    setEditDraft({ front: current.front, back: current.back });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!current || savingEdit) return;
    const front = editDraft.front.trim();
    const back = editDraft.back.trim();
    if (!front || !back) return;
    setSavingEdit(true);
    try {
      await flashcardService.classifyFlashcard(current.id, { front, back });
      setEdits(prev => ({ ...prev, [current.id]: { front, back } }));
      setFlashcards(prev => prev.map(f => f.id === current.id ? { ...f, front, back } : f));
      setEditing(false);
    } catch {
      // Keep the editor open so edits aren't lost on failure.
    } finally {
      setSavingEdit(false);
    }
  };
  const progress = cards.length > 0 ? (index / cards.length) * 100 : 0;
  const goodCount = Object.values(results).filter(r => r.rating >= 3).length;
  const hardCount = Object.values(results).filter(r => r.rating <= 2).length;
  const isModal = variant === 'modal';
  const rootClassName = isModal
    ? 'fixed inset-0 z-[150] flex items-center justify-center bg-black/40 md:p-8'
    : 'flex h-full min-h-[560px] items-center justify-center p-3 sm:p-6';
  const shellClassName = isModal
    ? 'flex flex-col bg-[var(--bg-app)] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-3xl md:shadow-2xl md:border md:border-[var(--border-color)] overflow-hidden'
    : 'flex h-full min-h-[540px] w-full max-w-lg flex-col overflow-hidden';

  const reset = () => {
    setIndex(0);
    setFlipped(false);
    setResults({});
    setDone(false);
    setEditing(false);
  };

  const advance = () => {
    setFlipped(false);
    setEditing(false);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  };

  const rate = async (rating: SessionRating) => {
    if (submitting || !current) return;
    setSubmitting(true);
    const newDifficulty = ratingToDifficulty(rating);
    const [reviewResult] = await Promise.allSettled([
      flashcardService.reviewFlashcard(current.id, rating),
      flashcardService.classifyFlashcard(current.id, { difficulty: newDifficulty }),
    ]);
    if (reviewResult.status === 'fulfilled') {
      setResults(prev => ({ ...prev, [current.id]: { rating, scheduledDays: reviewResult.value.scheduledDays } }));
    } else {
      setResults(prev => ({ ...prev, [current.id]: { rating, scheduledDays: 0 } }));
    }
    setFlashcards(prev => prev.map(f => f.id === current.id ? { ...f, difficulty: newDifficulty } : f));
    setSubmitting(false);
    advance();
  };

  if (!current && !done) return null;

  if (done) {
    const total = cards.length;
    const pct = total > 0 ? Math.round((goodCount / total) * 100) : 0;
    return (
      <div className={rootClassName}>
        <div className={cn(
          'flex flex-col items-center justify-center bg-[var(--bg-app)] p-6 w-full',
          isModal
            ? 'h-full md:h-auto md:max-w-lg md:rounded-3xl md:shadow-2xl md:border md:border-[var(--border-color)]'
            : 'min-h-[420px] max-w-lg rounded-3xl',
        )}>
          <Trophy size={48} className={cn('mb-4', pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500')} />
          <p className={cn('text-5xl font-black mb-2', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>{pct}%</p>
          <p className={cn('text-text-muted', isModal ? 'mb-1' : 'mb-8')}>{goodCount} good · {hardCount} need review</p>
          {isModal && <p className="text-sm text-text-muted mb-8">{title}</p>}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-5 py-3 text-sm font-bold text-text-muted"
            >
              <RotateCcw size={16} /> Restart
            </button>
            <button
              onClick={onClose ?? reset}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white"
            >
              {onClose ? 'Done' : 'Review again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div className={shellClassName}>
        <div className={cn('flex items-center gap-3 px-4 py-3', isModal && 'border-b border-[var(--border-color)]')}>
          {onClose ? (
            <button onClick={onClose} className="rounded-lg p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors shrink-0"><X size={20} /></button>
          ) : (
            <button
              onClick={reset}
              className="rounded-lg p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors shrink-0"
              aria-label="Reset review"
            >
              <RotateCcw size={20} />
            </button>
          )}
          <div className="flex-1 text-center">
            {isModal && <p className="text-xs font-bold text-text-muted truncate">{title}</p>}
            <p className="text-sm font-black text-text-main">{index + 1} / {cards.length}</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold shrink-0">
            {!editing && (
              <button
                onClick={startEditing}
                title="Edit card"
                className="rounded-lg p-1.5 text-zinc-400 hover:text-primary hover:bg-zinc-100 transition-colors"
              >
                <Pencil size={16} />
              </button>
            )}
            <span className="text-emerald-500">{goodCount}✓</span>
            <span className="text-red-500">{hardCount}✗</span>
          </div>
        </div>

        <div className="h-1 bg-zinc-100">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 select-none">
          {editing ? (
            <div className="w-full max-w-md space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-text-muted">Front</label>
                <textarea
                  autoFocus
                  value={editDraft.front}
                  onChange={e => setEditDraft(d => ({ ...d, front: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[var(--primary)]/40 bg-[var(--bg-app)] p-3 text-sm text-text-main outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-text-muted">Back</label>
                <textarea
                  value={editDraft.back}
                  onChange={e => setEditDraft(d => ({ ...d, back: e.target.value }))}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[var(--primary)]/40 bg-[var(--bg-app)] p-3 text-sm text-text-main outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:bg-zinc-100 transition-all border border-[var(--border-color)] disabled:opacity-50"
                >
                  <X size={13} /> Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit || !editDraft.front.trim() || !editDraft.back.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[var(--primary)] hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                </button>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id + (flipped ? '-back' : '-front')}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-md"
              >
                <FlashcardFlipCard
                  front={current.front}
                  back={current.back}
                  cardType={getFlashcardCardType(current)}
                  imageUrl={current.imageUrl}
                  occlusions={current.occlusions}
                  isFlipped={flipped}
                  onFlip={() => setFlipped(f => !f)}
                  variant="review"
                  hint="Tap to reveal"
                  className={cn(
                    'w-full max-w-md rounded-3xl',
                    isModal
                      ? 'border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl'
                      : 'border-0 bg-[var(--bg-app)] shadow-xl',
                  )}
                  style={{ minHeight: 280 }}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {flipped && !editing && (
          <div className="px-4 pb-8 space-y-2">
            <RatingControls
              onRate={(rating) => void rate(rating)}
              submitting={submitting}
              buttonClassName="flex flex-col items-center gap-0.5 rounded-2xl border-2 py-3 text-xs font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            />
          </div>
        )}
      </div>
    </div>
  );
};
