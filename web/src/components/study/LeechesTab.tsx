import React, { useCallback, useEffect, useState } from 'react';
import { Bug, Loader2, PauseCircle, PlayCircle, RotateCcw, Sparkles, Pencil } from 'lucide-react';
import { motion } from 'motion/react';
import { flashcardService } from '../../services/flashcardService';
import { Flashcard } from '../../types';
import { cn } from '../../utils/cn';

/**
 * Leeches: cards the FSRS scheduler keeps failing (high lapse count). They eat a
 * disproportionate share of review time, so this tab surfaces them with the three
 * standard remedies — rewrite the card, suspend it, or reset its scheduling.
 */
export const LeechesTab: React.FC<{ onEdit: (card: Flashcard) => void }> = ({ onEdit }) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    flashcardService.getLeeches()
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleSuspended = async (card: Flashcard) => {
    if (!card.srs) return;
    setBusyId(card.id);
    try {
      const srs = await flashcardService.setSuspended(card.id, !card.srs.isSuspended);
      setCards(prev => prev.map(c => (c.id === card.id ? { ...c, srs } : c)));
    } catch {
      alert('Could not update the card. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const resetCard = async (card: Flashcard) => {
    if (!window.confirm('Reset this card’s scheduling? It will start over as a new card. Its review history is kept.')) return;
    setBusyId(card.id);
    try {
      await flashcardService.resetSrs(card.id);
      setCards(prev => prev.filter(c => c.id !== card.id));
    } catch {
      alert('Could not reset the card. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>;
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles size={24} className="text-zinc-300 mb-3" />
        <p className="text-sm font-semibold text-text-main">No leeches</p>
        <p className="text-xs text-text-muted mt-1 max-w-[40ch] leading-relaxed">
          A card becomes a leech when you keep forgetting it (4+ lapses). Right now every card is sticking — keep it up.
        </p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 px-4 py-3">
        <Bug size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <p className="text-xs text-text-muted leading-relaxed">
          These {cards.length === 1 ? 'is 1 card' : `are ${cards.length} cards`} you keep forgetting. Leeches eat review time without sticking —
          the usual fixes are to <span className="font-semibold text-text-main">rewrite</span> the card so it tests one small thing,{' '}
          <span className="font-semibold text-text-main">suspend</span> it if it isn't worth the effort, or{' '}
          <span className="font-semibold text-text-main">reset</span> its scheduling for a fresh start.
        </p>
      </div>

      <div className="space-y-2">
        {cards.map(card => {
          const suspended = card.srs?.isSuspended ?? false;
          const busy = busyId === card.id;
          return (
            <div
              key={card.id}
              className={cn(
                'rounded-xl bg-white dark:bg-zinc-800 border border-[var(--border-color)] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3',
                suspended && 'opacity-60',
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-main truncate">{card.front}</p>
                <p className="text-xs text-text-muted truncate mt-0.5">{card.back}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                    {card.srs?.lapses ?? 0} lapses
                  </span>
                  {card.srs && (
                    <span className="text-[10px] text-text-muted tabular-nums">{card.srs.reps} reviews</span>
                  )}
                  {(card.documentName || card.videoName) && (
                    <span className="text-[10px] text-text-muted truncate max-w-[24ch]">{card.documentName ?? card.videoName}</span>
                  )}
                  {suspended && (
                    <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-700 text-text-muted px-2 py-0.5 text-[10px] font-bold">
                      Suspended
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onEdit(card)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-main hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  title="Rewrite the card"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => toggleSuspended(card)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-main hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  title={suspended ? 'Put the card back into review rotation' : 'Keep the card but stop scheduling it'}
                >
                  {suspended ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                  {suspended ? 'Resume' : 'Suspend'}
                </button>
                <button
                  onClick={() => resetCard(card)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title="Forget the scheduling and start over"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  Reset
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
