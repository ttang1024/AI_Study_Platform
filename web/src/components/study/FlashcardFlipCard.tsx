import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, BarChart2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ClozeText } from './ClozeText';
import { MathText } from './MathText';
import { CardChart } from './CardChart';

export type FlashcardCardType = 'basic' | 'cloze' | 'chart';
export type FlashcardCardStyle = 'flip' | 'compact' | 'review';

interface FlashcardFlipCardProps {
  front: string;
  back: string;
  cardType?: FlashcardCardType;
  isFlipped: boolean;
  onFlip: () => void;
  variant?: FlashcardCardStyle;
  /** Compact crossfade variant for dense grid layouts (e.g. Hard Flashcards in Daily Review) */
  compact?: boolean;
  /** Source label shown at the bottom of the compact variant */
  sourceName?: string;
  /** Optional badge text shown in the top-right corner of the compact variant */
  badgeLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  hint?: string;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  children?: React.ReactNode;
}

export const getFlashcardCardType = (
  card: { front?: string; cardType?: FlashcardCardType } | undefined,
): FlashcardCardType => {
  if (!card) return 'basic';
  if (card.cardType) return card.cardType;
  return /\{\{[^}]+\}\}/.test(card.front ?? '') ? 'cloze' : 'basic';
};

export const FlashcardFlipCard: React.FC<FlashcardFlipCardProps> = ({
  front,
  back,
  cardType,
  isFlipped,
  onFlip,
  variant = 'flip',
  compact = false,
  sourceName,
  badgeLabel,
  className,
  style,
  hint,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}) => {
  const effectiveVariant = compact ? 'compact' : variant;
  const effectiveCardType = getFlashcardCardType({ front, cardType });
  const isCloze = effectiveCardType === 'cloze';
  const isChart = effectiveCardType === 'chart';

  if (effectiveVariant === 'compact') {
    return (
      <div
        onClick={onFlip}
        className={cn(
          'group relative cursor-pointer rounded-3xl border-2 p-5 flex flex-col gap-3 transition-all duration-300 select-none min-h-[130px] shadow-xl',
          isFlipped
            ? 'border-[var(--primary)] bg-[var(--bg-app)]'
            : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] hover:border-[var(--primary)]/40 hover:shadow-2xl',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-[10px] font-black uppercase tracking-widest',
            isFlipped ? 'text-[var(--primary)]' : 'text-text-muted',
          )}>
            {isFlipped ? 'Back' : 'Front'}
          </span>
          <span className={cn(
            'text-[10px] transition-colors',
            isFlipped ? 'text-[var(--primary)]/60' : 'text-text-muted group-hover:text-[var(--primary)]/60',
          )}>
            {isFlipped ? 'tap to reset' : 'tap to reveal →'}
          </span>
        </div>

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={isFlipped ? 'back' : 'front'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-medium text-text-main leading-relaxed"
            >
              {isFlipped ? back : front}
            </motion.p>
          </AnimatePresence>
        </div>

        {sourceName && (
          <p className="text-[10px] text-text-muted/60 truncate">{sourceName}</p>
        )}

        {badgeLabel && (
          <span className="absolute top-3 right-3 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-600">
            {badgeLabel}
          </span>
        )}
      </div>
    );
  }

  if (effectiveVariant === 'review') {
    return (
      <div
        onClick={onFlip}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={cn(
          'rounded-2xl border-2 border-[var(--border-color)] bg-[var(--bg-app)] hover:border-[var(--primary)]/30 p-8 cursor-pointer select-none min-h-48 flex flex-col items-center justify-center text-center transition-colors',
          className,
        )}
        style={style}
      >
        {children}

        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-4">
          {isCloze ? 'Fill in the blank' :
           isChart ? (isFlipped ? 'Chart' : 'Chart Question') :
           isFlipped ? 'Answer' : 'Question'}
        </p>

        {isCloze ? (
          <p className="text-lg font-semibold text-text-main leading-loose">
            <ClozeText text={front} revealed={isFlipped} />
          </p>
        ) : isChart ? (
          isFlipped ? (
            <div className="w-full">
              <CardChart data={back} />
              <p className="text-sm text-text-muted mt-2 pt-2 border-t border-[var(--border-color)]">
                <MathText text={front} />
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <BarChart2 size={32} className="text-[var(--primary)]/50" />
              <p className="text-lg font-semibold text-text-main leading-relaxed">
                <MathText text={front} />
              </p>
            </div>
          )
        ) : (
          <p className="text-lg font-semibold text-text-main leading-relaxed">
            {isFlipped
              ? <MathText text={back} inline={false} />
              : <MathText text={front} />}
          </p>
        )}

        {!isFlipped && (
          <p className="text-xs text-text-muted mt-6">{hint ?? 'Click to reveal answer'}</p>
        )}
      </div>
    );
  }

  if (isChart) {
    return (
      <div
        className="relative w-full cursor-pointer"
        style={{ minHeight: 300 }}
        onClick={onFlip}
      >
        <div className={cn(
          'flex flex-col rounded-3xl border-2 p-5 sm:p-7 shadow-xl transition-all duration-300',
          isFlipped
            ? 'border-[var(--primary)] bg-[var(--bg-app)]'
            : 'border-[var(--border-color)] bg-[var(--bg-sidebar)]',
        )}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={14} className="text-[var(--primary)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary)]">
              {isFlipped ? 'Chart' : 'Chart Question'}
            </span>
          </div>
          {!isFlipped ? (
            <div className="flex flex-col items-center justify-center py-6 text-center" style={{ minHeight: 220 }}>
              <h3 className="text-lg sm:text-2xl font-bold text-text-main leading-relaxed">
                <MathText text={front} />
              </h3>
              <div className="mt-6 text-sm text-text-muted flex items-center gap-2">
                <HelpCircle size={14} />
                Click to reveal chart
              </div>
            </div>
          ) : (
            <div>
              <CardChart data={back} className="mb-3" />
              <p className="text-sm font-medium text-text-muted border-t border-[var(--border-color)] pt-3">
                <MathText text={front} />
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isCloze) {
    return (
      <div
        className="relative w-full cursor-pointer"
        style={{ minHeight: 300 }}
        onClick={onFlip}
      >
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-3xl border-2 p-6 sm:p-10 text-center shadow-xl transition-all duration-300',
            isFlipped
              ? 'border-[var(--primary)] bg-[var(--bg-app)]'
              : 'border-[var(--border-color)] bg-[var(--bg-sidebar)]',
          )}
          style={{ minHeight: 300 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary)]">Fill in the blank</span>
            <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-black text-[var(--primary)] uppercase tracking-widest">Cloze</span>
          </div>
          <p className="text-lg sm:text-2xl font-semibold text-text-main leading-loose">
            <ClozeText text={front} revealed={isFlipped} />
          </p>
          {back && isFlipped && (
            <p className="mt-4 text-sm text-text-muted border-t border-[var(--border-color)] pt-3 w-full">
              <MathText text={back} />
            </p>
          )}
          {!isFlipped && (
            <div className="absolute bottom-4 sm:bottom-8 text-[10px] sm:text-sm text-text-muted flex items-center gap-2">
              <HelpCircle size={14} />
              Click to reveal the answer
            </div>
          )}
        </div>
      </div>
    );
  }

  // Basic 3-D flip
  return (
    <div
      className="perspective-1000 relative h-[320px] sm:h-[460px] w-full cursor-pointer"
      onClick={onFlip}
    >
      <motion.div
        className="relative h-full w-full transition-all duration-500 preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="absolute inset-0 backface-hidden">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border-2 border-[var(--border-color)] bg-[var(--bg-sidebar)] p-6 sm:p-10 text-center shadow-xl">
            <span className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--primary)]">Concept</span>
            <h3 className="text-lg sm:text-2xl font-bold text-text-main leading-relaxed">
              <MathText text={front} />
            </h3>
            <div className="absolute bottom-4 sm:bottom-8 text-[10px] sm:text-sm text-text-muted flex items-center gap-2">
              <HelpCircle size={14} />
              Click to reveal explanation
            </div>
          </div>
        </div>

        <div className="absolute inset-0 backface-hidden rotate-y-180">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border-2 border-[var(--primary)] bg-[var(--bg-app)] p-6 sm:p-12 text-center shadow-xl overflow-y-auto">
            <span className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--primary)]">Explanation</span>
            <div className="text-base sm:text-xl text-text-main leading-relaxed">
              <MathText text={back} inline={false} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
