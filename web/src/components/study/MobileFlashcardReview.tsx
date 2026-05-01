import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { cn } from '../../utils/cn';

interface Card {
  id: string;
  front: string;
  back: string;
}

interface MobileFlashcardReviewProps {
  cards: Card[];
  title: string;
  onClose: () => void;
}

type Rating = 'known' | 'unknown';

export const MobileFlashcardReview: React.FC<MobileFlashcardReviewProps> = ({ cards, title, onClose }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [done, setDone] = useState(false);

  // Swipe state (pointer events work for both mouse and touch)
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const hasDragged = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);

  const current = cards[index];
  const known = Object.values(ratings).filter(r => r === 'known').length;
  const unknown = Object.values(ratings).filter(r => r === 'unknown').length;
  const progress = (index / cards.length) * 100;

  const rate = (rating: Rating) => {
    setRatings(prev => ({ ...prev, [current.id]: rating }));
    setFlipped(false);
    setDragX(0);
    setSwipeDir(null);
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
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
    if (Math.abs(dragX) > 80) {
      rate(dragX > 0 ? 'known' : 'unknown');
    } else {
      setDragX(0);
      setSwipeDir(null);
    }
    pointerStartX.current = null;
  };

  if (done) {
    const total = cards.length;
    const pct = Math.round((known / total) * 100);
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 md:p-8">
      <div className="flex flex-col items-center justify-center bg-[var(--bg-app)] p-6 w-full h-full md:h-auto md:max-w-lg md:rounded-3xl md:shadow-2xl md:border md:border-[var(--border-color)]">
        <Trophy size={48} className={cn('mb-4', pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500')} />
        <p className={cn('text-5xl font-black mb-2', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>{pct}%</p>
        <p className="text-text-muted mb-1">{known} known · {unknown} review needed</p>
        <p className="text-sm text-text-muted mb-8">{title}</p>
        <div className="flex gap-3">
          <button
            onClick={() => { setIndex(0); setFlipped(false); setRatings({}); setDone(false); }}
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
          <span className="text-emerald-500">{known}✓</span>
          <span className="text-red-500">{unknown}✗</span>
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
              'w-full max-w-md rounded-3xl border-2 p-8 shadow-2xl cursor-pointer text-center',
              swipeDir === 'right' ? 'border-emerald-400 bg-emerald-50/80' :
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
              <div className="absolute top-4 left-4 flex items-center gap-1 text-emerald-600 font-black text-lg">
                <CheckCircle2 size={24} /> Know it!
              </div>
            )}
            {swipeDir === 'left' && (
              <div className="absolute top-4 right-4 flex items-center gap-1 text-red-600 font-black text-lg">
                Review <XCircle size={24} />
              </div>
            )}

            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-4">
              {flipped ? 'Answer' : 'Question'}
            </p>
            <p className="text-lg font-semibold text-text-main leading-relaxed">
              {flipped ? current.back : current.front}
            </p>
            {!flipped && (
              <p className="text-xs text-text-muted mt-6">Tap to reveal</p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Swipe hints */}
        <div className="flex items-center gap-8 mt-6 text-xs text-text-muted">
          <span className="flex items-center gap-1"><ChevronLeft size={14} /> Swipe left to review</span>
          <span className="flex items-center gap-1">Swipe right to know <ChevronRight size={14} /></span>
        </div>
      </div>

      {/* Action buttons */}
      {flipped && (
        <div className="flex gap-3 px-4 pb-8">
          <button
            onClick={() => rate('unknown')}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-red-300 bg-red-50 py-4 text-base font-black text-red-600"
          >
            <XCircle size={20} /> Need Review
          </button>
          <button
            onClick={() => rate('known')}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50 py-4 text-base font-black text-emerald-600"
          >
            <CheckCircle2 size={20} /> Know it!
          </button>
        </div>
      )}
      </div>
    </div>
  );
};
