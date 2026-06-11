import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, RotateCcw, ThumbsUp, ThumbsDown, Minus, ChevronsUp } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const CARDS = [
  { q: 'What is the powerhouse of the cell?', a: 'The mitochondrion — it produces ATP through oxidative phosphorylation.' },
  { q: 'Define osmosis.', a: 'Movement of water across a semipermeable membrane from low to high solute concentration.' },
  { q: 'What does DNA stand for?', a: 'Deoxyribonucleic acid — the molecule carrying genetic instructions.' },
];

export const BentoFlashcardCard: React.FC = () => {
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);

  const advance = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCardIdx(i => (i + 1) % CARDS.length);
      setFlipped(false);
      setAnimating(false);
    }, 220);
  };

  const card = CARDS[cardIdx];

  return (
    <BentoCardShell
      background="rgba(251,146,60,0.06)"
      border="rgba(251,146,60,0.2)"
      hoverShadow="0 0 48px rgba(251,146,60,0.24), 0 0 80px rgba(251,146,60,0.10)"
      hoverBorder="rgba(251,146,60,0.42)"
    >
      <BentoCardHeader
        icon={CreditCard}
        title="AI Flashcards"
        gradient="from-amber-400 via-orange-500 to-red-500"
        iconGlow="0 6px 22px rgba(251,146,60,0.4)"
        right={
          <span
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}
          >
            {cardIdx + 1} / {CARDS.length}
          </span>
        }
      />

      <div
        className="flex-1 rounded-xl mb-3 relative overflow-hidden cursor-pointer select-none"
        style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', minHeight: '100px', perspective: '800px' }}
        onClick={() => !animating && setFlipped(f => !f)}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0, opacity: animating ? 0 : 1 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%', position: 'relative' }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 py-4" style={{ backfaceVisibility: 'hidden' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Question</span>
            <p className="text-sm font-semibold text-white/80 text-center leading-snug">{card.q}</p>
            <div className="flex items-center gap-1 mt-1">
              <RotateCcw className="w-3 h-3 text-white/20" />
              <span className="text-[10px] text-white/20">tap to reveal</span>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 py-4" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#fb923c' }}>Answer</span>
            <p className="text-xs text-white/70 text-center leading-relaxed">{card.a}</p>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        <button onClick={advance}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors hover:bg-red-500/20"
          style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <ThumbsDown className="w-3 h-3" /> Again
        </button>
        <button onClick={advance}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors hover:bg-amber-500/20"
          style={{ border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c' }}>
          <Minus className="w-3 h-3" /> Hard
        </button>
        <button onClick={advance}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors hover:bg-emerald-500/20"
          style={{ border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
          <ThumbsUp className="w-3 h-3" /> Good
        </button>
        <button onClick={advance}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors hover:bg-cyan-500/20"
          style={{ border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee' }}>
          <ChevronsUp className="w-3 h-3" /> Easy
        </button>
      </div>
    </BentoCardShell>
  );
};
