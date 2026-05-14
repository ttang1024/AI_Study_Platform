import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart2, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Flashcard } from '../../types';
import { ClozeText } from './ClozeText';
import { MathText } from './MathText';
import { CardChart } from './CardChart';

export type SessionRating = 1 | 2 | 3 | 4;

export const SESSION_RATINGS: { rating: SessionRating; label: string; color: string; border: string; bg: string }[] = [
  { rating: 1, label: 'Again', color: 'text-red-600',    border: 'border-red-300',    bg: 'bg-red-50 dark:bg-red-950/30' },
  { rating: 2, label: 'Hard',  color: 'text-orange-500', border: 'border-orange-300', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  { rating: 3, label: 'Good',  color: 'text-green-600',  border: 'border-green-300',  bg: 'bg-green-50 dark:bg-green-950/30' },
  { rating: 4, label: 'Easy',  color: 'text-blue-600',   border: 'border-blue-300',   bg: 'bg-blue-50 dark:bg-blue-950/30' },
];

interface FlashcardSessionCardProps {
  card: Flashcard;
  flipped: boolean;
  onFlip: () => void;
  onRate: (rating: SessionRating) => void;
  submitting?: boolean;
}

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
        onClick={onFlip}
        className="rounded-2xl border-2 border-[var(--border-color)] bg-[var(--bg-app)] hover:border-[var(--primary)]/30 p-8 cursor-pointer select-none min-h-48 flex flex-col items-center justify-center text-center transition-colors"
      >
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-4">
          {card.cardType === 'cloze' ? 'Fill in the blank' :
           card.cardType === 'chart' ? (flipped ? 'Chart' : 'Chart Question') :
           flipped ? 'Answer' : 'Question'}
        </p>

        {card.cardType === 'cloze' ? (
          <p className="text-lg font-semibold text-text-main leading-loose">
            <ClozeText text={card.front} revealed={flipped} />
          </p>
        ) : card.cardType === 'chart' ? (
          flipped ? (
            <div className="w-full">
              <CardChart data={card.back} />
              <p className="text-sm text-text-muted mt-2 pt-2 border-t border-[var(--border-color)]">
                <MathText text={card.front} />
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <BarChart2 size={32} className="text-[var(--primary)]/50" />
              <p className="text-lg font-semibold text-text-main leading-relaxed">
                <MathText text={card.front} />
              </p>
            </div>
          )
        ) : (
          <p className="text-lg font-semibold text-text-main leading-relaxed">
            {flipped
              ? <MathText text={card.back} inline={false} />
              : <MathText text={card.front} />}
          </p>
        )}

        {!flipped && (
          <p className="text-xs text-text-muted mt-6">Click to reveal answer</p>
        )}
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
                  'flex items-center justify-center rounded-2xl border-2 py-3 text-xs font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-60',
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
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
