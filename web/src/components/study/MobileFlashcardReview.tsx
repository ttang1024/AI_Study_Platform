import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, RotateCcw, Trophy, Loader2, BarChart2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { flashcardService } from '../../services/flashcardService';
import { useStudy } from '../../context/StudyContext';
import { ClozeText } from './ClozeText';
import { MathText } from './MathText';
import { CardChart } from './CardChart';

interface Card {
  id: string;
  front: string;
  back: string;
  cardType?: 'basic' | 'cloze' | 'chart';
}

interface MobileFlashcardReviewProps {
  cards: Card[];
  title: string;
  onClose: () => void;
}

type Rating = 1 | 2 | 3 | 4;

interface RatingResult {
  rating: Rating;
  scheduledDays: number;
}

const RATINGS: { rating: Rating; label: string; swipeDir?: 'left' | 'right'; color: string; border: string; bg: string }[] = [
  { rating: 1, label: 'Again',  color: 'text-red-600',    border: 'border-red-300',    bg: 'bg-red-50' },
  { rating: 2, label: 'Hard',   color: 'text-orange-600', border: 'border-orange-300', bg: 'bg-orange-50' },
  { rating: 3, label: 'Good',   color: 'text-green-600',  border: 'border-green-300',  bg: 'bg-green-50' },
  { rating: 4, label: 'Easy',   color: 'text-blue-600',   border: 'border-blue-300',   bg: 'bg-blue-50' },
];

const ratingToDifficulty = (r: Rating): 'easy' | 'medium' | 'hard' =>
  r === 4 ? 'easy' : r === 3 ? 'medium' : 'hard';

export const MobileFlashcardReview: React.FC<MobileFlashcardReviewProps> = ({ cards, title, onClose }) => {
  const { setFlashcards } = useStudy();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, RatingResult>>({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Swipe state
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const hasDragged = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);

  const current = cards[index];
  const progress = (index / cards.length) * 100;

  const goodCount = Object.values(results).filter(r => r.rating >= 3).length;
  const hardCount = Object.values(results).filter(r => r.rating <= 2).length;

  const advance = () => {
    setFlipped(false);
    setDragX(0);
    setSwipeDir(null);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  };

  const rate = async (rating: Rating) => {
    if (submitting) return;
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

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    hasDragged.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartX.current === null) return;
    const dx = e.clientX - pointerStartX.current;
    const dy = Math.abs(e.clientY - (pointerStartY.current ?? 0));
    if (Math.abs(dx) > dy) {
      if (Math.abs(dx) > 8) hasDragged.current = true;
      setDragX(dx);
      setSwipeDir(dx > 0 ? 'right' : 'left');
    }
  };

  const handlePointerUp = () => {
    if (Math.abs(dragX) > 80 && flipped) {
      // Swipe right = Good (3), swipe left = Again (1)
      void rate(dragX > 0 ? 3 : 1);
    } else {
      setDragX(0);
      setSwipeDir(null);
    }
    pointerStartX.current = null;
  };

  if (done) {
    const total = cards.length;
    const pct = Math.round((goodCount / total) * 100);
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 md:p-8">
        <div className="flex flex-col items-center justify-center bg-[var(--bg-app)] p-6 w-full h-full md:h-auto md:max-w-lg md:rounded-3xl md:shadow-2xl md:border md:border-[var(--border-color)]">
          <Trophy size={48} className={cn('mb-4', pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500')} />
          <p className={cn('text-5xl font-black mb-2', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>{pct}%</p>
          <p className="text-text-muted mb-1">{goodCount} good · {hardCount} need review</p>
          <p className="text-sm text-text-muted mb-8">{title}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { setIndex(0); setFlipped(false); setResults({}); setDone(false); }}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-5 py-3 text-sm font-bold text-text-muted"
            >
              <RotateCcw size={16} /> Restart
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 md:p-8">
      <div className="flex flex-col bg-[var(--bg-app)] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-3xl md:shadow-2xl md:border md:border-[var(--border-color)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
          <button onClick={onClose} className="rounded-lg p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors shrink-0"><X size={20} /></button>
          <div className="flex-1 text-center">
            <p className="text-xs font-bold text-text-muted truncate">{title}</p>
            <p className="text-sm font-black text-text-main">{index + 1} / {cards.length}</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold shrink-0">
            <span className="text-emerald-500">{goodCount}✓</span>
            <span className="text-red-500">{hardCount}✗</span>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1 bg-zinc-100">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        {/* Card area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 select-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id + (flipped ? '-back' : '-front')}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, x: dragX, rotate: dragX * 0.05 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                'w-full max-w-md rounded-3xl border-2 p-8 shadow-2xl cursor-pointer text-center relative',
                swipeDir === 'right' ? 'border-green-400 bg-green-50/80' :
                  swipeDir === 'left' ? 'border-red-400 bg-red-50/80' :
                    'border-[var(--border-color)] bg-[var(--bg-sidebar)]',
              )}
              style={{ minHeight: 280, touchAction: 'none', cursor: 'grab' }}
              onClick={() => { if (!hasDragged.current) setFlipped(f => !f); }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {swipeDir === 'right' && (
                <div className="absolute top-4 left-4 flex items-center gap-1 text-green-600 font-black text-lg">Good!</div>
              )}
              {swipeDir === 'left' && (
                <div className="absolute top-4 right-4 flex items-center gap-1 text-red-600 font-black text-lg">Again</div>
              )}

              <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-4">
                {current.cardType === 'cloze' ? 'Fill in the blank' : current.cardType === 'chart' ? (flipped ? 'Chart' : 'Chart Question') : flipped ? 'Answer' : 'Question'}
              </p>
              {current.cardType === 'cloze' ? (
                <p className="text-lg font-semibold text-text-main leading-loose">
                  <ClozeText text={current.front} revealed={flipped} />
                </p>
              ) : current.cardType === 'chart' ? (
                flipped ? (
                  <div className="w-full">
                    <CardChart data={current.back} />
                    <p className="text-sm text-text-muted mt-2 pt-2 border-t border-[var(--border-color)]">
                      <MathText text={current.front} />
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <BarChart2 size={32} className="text-[var(--primary)]/50" />
                    <p className="text-lg font-semibold text-text-main leading-relaxed">
                      <MathText text={current.front} />
                    </p>
                  </div>
                )
              ) : (
                <p className="text-lg font-semibold text-text-main leading-relaxed">
                  {flipped
                    ? <MathText text={current.back} inline={false} />
                    : <MathText text={current.front} />
                  }
                </p>
              )}
              {!flipped && (
                <p className="text-xs text-text-muted mt-6">Tap to reveal</p>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-8 mt-6 text-xs text-text-muted">
            <span className="flex items-center gap-1"><ChevronLeft size={14} /> Again</span>
            <span className="flex items-center gap-1">Good <ChevronRight size={14} /></span>
          </div>
        </div>

        {/* FSRS Rating buttons — appear after flip */}
        {flipped && (
          <div className="px-4 pb-8 space-y-2">
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-text-muted mb-3">How well did you remember?</p>
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map(({ rating, label, color, border, bg }) => (
                <button
                  key={rating}
                  onClick={() => void rate(rating)}
                  disabled={submitting}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-2xl border-2 py-3 text-xs font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-60',
                    bg, border, color,
                  )}
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <span className="text-sm">{label}</span>}
                </button>
              ))}
            </div>
            <div className="flex justify-between px-1 text-[10px] text-text-muted">
              <span>Complete blackout</span>
              <span>Perfect recall</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
