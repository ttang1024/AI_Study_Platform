import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, RotateCcw } from 'lucide-react';
import type { FeatureTheme } from '../theme';

const CARDS = [
  { term: 'chlorophyll', q: 'Which pigment absorbs light for photosynthesis?', a: 'Chlorophyll, found in the thylakoid membranes of the chloroplast.' },
  { term: 'Calvin cycle', q: 'Where is carbon dioxide fixed into sugar?', a: 'In the Calvin cycle, which runs in the stroma of the chloroplast.' },
  { term: 'ATP and NADPH', q: 'What do the light reactions hand to the Calvin cycle?', a: 'ATP and NADPH, the energy and reducing power it needs.' },
];

const SOURCE = 'Light is absorbed by chlorophyll in the thylakoid membranes. The light reactions produce ATP and NADPH, which power the Calvin cycle in the stroma, where carbon dioxide is fixed into sugar.';

/** Highlights each card's source phrase, so the link between notes and cards is visible. */
const HighlightedSource: React.FC<{ active: string; theme: FeatureTheme }> = ({ active, theme }) => {
  const parts = SOURCE.split(/(chlorophyll|ATP and NADPH|Calvin cycle)/g);
  return (
    <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>
      {parts.map((part, i) =>
        CARDS.some((c) => c.term === part) ? (
          <mark key={i} className="rounded px-0.5 transition-colors"
            style={{ background: part === active ? theme.accent : theme.accentSoft, color: part === active ? '#03202b' : theme.accentText }}>
            {part}
          </mark>
        ) : <React.Fragment key={i}>{part}</React.Fragment>,
      )}
    </p>
  );
};

export const FlashcardHero: React.FC<{ theme: FeatureTheme }> = ({ theme }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = CARDS[index];

  const next = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % CARDS.length);
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="rounded-2xl p-4 mb-5 -rotate-1" style={{ background: theme.surface, border: `1px dashed ${theme.accent}`, boxShadow: theme.cardShadow }}>
        <p className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: theme.accentText }}>
          <FileText className="w-3.5 h-3.5" /> Biology_ch3.pdf
        </p>
        <HighlightedSource active={card.term} theme={theme} />
      </div>

      <div className="relative h-56" style={{ perspective: 1000 }}>
        {/* The rest of the deck peeking out underneath. */}
        <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-2xl" style={{ background: '#a5f3fc' }} />
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[1.5deg] rounded-2xl" style={{ background: '#67e8f9' }} />
        <motion.button
          type="button"
          key={index}
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Show question' : 'Show answer'}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1, rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          className="absolute inset-0 w-full cursor-pointer text-left"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between"
            style={{ backfaceVisibility: 'hidden', background: '#ffffff', color: theme.text, border: `1px solid ${theme.line}`, boxShadow: '0 20px 40px -12px rgba(15,23,42,0.2)',
              backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 27px, rgba(14,165,233,0.16) 27px 28px)' }}>
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-700">Question {index + 1} of {CARDS.length}</span>
            <p className="text-xl font-bold leading-snug" style={{ fontFamily: theme.headingFont }}>{card.q}</p>
            <span className="text-xs text-slate-500">Tap to flip</span>
          </div>
          <div className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'linear-gradient(135deg, #0891b2, #2563eb)', color: '#fff', boxShadow: '0 20px 40px -12px rgba(8,145,178,0.45)' }}>
            <span className="text-xs font-bold uppercase tracking-widest text-white/80">Answer</span>
            <p className="text-lg font-semibold leading-snug" style={{ fontFamily: theme.headingFont }}>{card.a}</p>
            <span className="text-xs text-white/75">Tap to flip back</span>
          </div>
        </motion.button>
      </div>

      <div className="flex justify-end mt-6">
        <button type="button" onClick={next}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full"
          style={{ background: theme.accentSoft, color: theme.accentText }}>
          <RotateCcw className="w-3.5 h-3.5" /> Next card
        </button>
      </div>
    </div>
  );
};
