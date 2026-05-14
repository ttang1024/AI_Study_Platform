import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BrainCircuit, BarChart2, AlignLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Flashcard } from '../../types';
import { flashcardService } from '../../services/flashcardService';
import { useStudy } from '../../context/StudyContext';
import { FlashcardSessionCard, SessionRating } from './FlashcardSessionCard';

interface HardFlashcardReviewProps {
  cards: Flashcard[];
  onRate: (cardId: string, rating: SessionRating) => void;
}

const cardTypeIcon = (type: string | undefined) => {
  if (type === 'chart') return <BarChart2 size={14} className="text-text-muted" />;
  if (type === 'cloze') return <AlignLeft size={14} className="text-text-muted" />;
  return <BrainCircuit size={14} className="text-[#059669]" />;
};

const cardTypeLabel = (type: string | undefined) => {
  if (type === 'chart') return 'Chart';
  if (type === 'cloze') return 'Cloze';
  return 'Standard';
};

export const HardFlashcardReview: React.FC<HardFlashcardReviewProps> = ({ cards, onRate }) => {
  const { setFlashcards } = useStudy();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedCard = selectedIndex !== null ? cards[selectedIndex] ?? null : null;

  const handleOpen = (index: number) => {
    setSelectedIndex(index);
    setFlipped(false);
  };

  const handleClose = () => {
    if (submitting) return;
    setSelectedIndex(null);
    setFlipped(false);
  };

  const handleNav = (delta: number) => {
    if (selectedIndex === null) return;
    setSelectedIndex(i => Math.max(0, Math.min(cards.length - 1, (i ?? 0) + delta)));
    setFlipped(false);
  };

  const handleRate = useCallback(async (rating: SessionRating) => {
    if (!selectedCard || selectedIndex === null || submitting) return;
    setSubmitting(true);
    const newDifficulty = rating === 4 ? 'easy' : rating === 3 ? 'medium' : 'hard';
    const [reviewResult] = await Promise.allSettled([
      flashcardService.reviewFlashcard(selectedCard.id, rating),
      flashcardService.classifyFlashcard(selectedCard.id, { difficulty: newDifficulty }),
    ]);
    if (reviewResult.status === 'fulfilled') {
      const newSrs = reviewResult.value.srs;
      setFlashcards(prev => prev.map(f =>
        f.id === selectedCard.id ? { ...f, difficulty: newDifficulty, srs: newSrs } : f,
      ));
    } else {
      setFlashcards(prev => prev.map(f =>
        f.id === selectedCard.id ? { ...f, difficulty: newDifficulty } : f,
      ));
    }
    setFlipped(false);
    setSubmitting(false);
    onRate(selectedCard.id, rating);
    // Good/Easy removes the card: staying at selectedIndex shows the next card that shifts in.
    // If it was the last card, cards[selectedIndex] becomes undefined → selectedCard = null → modal closes.
    // Again/Hard at a non-last position: card rotates to end, next card shifts to selectedIndex.
    // Again/Hard at the last position: card stays at end (no shift), so close explicitly.
    const nextIndex = rating >= 3 || selectedIndex < cards.length - 1 ? selectedIndex : null;
    setSelectedIndex(nextIndex);
  }, [selectedCard, selectedIndex, cards.length, submitting, setFlashcards, onRate]);

  return (
    <>
      <div className="space-y-2">
        {cards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => handleOpen(i)}
            className="w-full text-left rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[#059669]/50 hover:bg-[var(--bg-sidebar)] transition-all p-3 flex items-center gap-3 group"
          >
            <span className="shrink-0 w-6 text-center text-xs font-semibold text-text-muted">
              {i + 1}
            </span>

            <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#059669]/10">
              {cardTypeIcon(card.cardType)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-main truncate leading-snug">{card.front}</p>
              <p className="text-xs text-text-muted mt-0.5">{cardTypeLabel(card.cardType)}</p>
            </div>

            <span className="shrink-0 text-xs font-semibold text-[#059669] opacity-0 group-hover:opacity-100 transition-opacity">
              Review →
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedCard !== null && selectedIndex !== null && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/40 z-40"
            />

            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl overflow-hidden pointer-events-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <BrainCircuit size={16} className="text-[#059669]" />
                    <span className="text-sm font-semibold text-text-main">Hard Flashcard</span>
                    <span className="rounded-full bg-[#059669]/15 px-2 py-0.5 text-[10px] font-medium text-[#059669] uppercase tracking-wide">
                      {cardTypeLabel(selectedCard.cardType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted font-medium">
                      {selectedIndex + 1} / {cards.length}
                    </span>
                    <button
                      onClick={handleClose}
                      disabled={submitting}
                      className="rounded-lg p-1.5 text-text-muted hover:text-text-main hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <FlashcardSessionCard
                  card={selectedCard}
                  flipped={flipped}
                  onFlip={() => setFlipped(f => !f)}
                  onRate={handleRate}
                  submitting={submitting}
                />

                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
                  <button
                    onClick={() => handleNav(-1)}
                    disabled={selectedIndex === 0 || submitting}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-main hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    onClick={() => handleNav(1)}
                    disabled={selectedIndex === cards.length - 1 || submitting}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-main hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
