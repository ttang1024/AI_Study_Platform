import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { PenLine } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const NOTE_LINES = [
  { text: 'Mitochondria are the powerhouse of the cell.', color: '#22d3ee' },
  { text: 'ATP synthesis drives cellular respiration.', color: '#a78bfa' },
  { text: 'Key enzymes: citrate synthase, NADH dehydrogenase', color: '#fbbf24' },
];

export const BentoNoteCard: React.FC = () => {
  const [typed, setTyped] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const target = NOTE_LINES[2].text.length;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(i);
      if (i >= target) clearInterval(iv);
    }, 38);
    return () => clearInterval(iv);
  }, [inView]);

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(251,191,36,0.06)"
      border="rgba(251,191,36,0.18)"
      hoverShadow="0 0 48px rgba(251,191,36,0.35), 0 0 80px rgba(251,191,36,0.12)"
      hoverBorder="rgba(251,191,36,0.4)"
    >
      <BentoCardHeader
        icon={PenLine}
        title="Notes"
        gradient="from-yellow-400 via-orange-400 to-rose-500"
        iconGlow="0 6px 22px rgba(251,191,36,0.35)"
      />

      <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          {['B', 'I', 'U'].map(l => (
            <button key={l} className="text-[10px] font-bold w-5 h-5 rounded text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">{l}</button>
          ))}
          <div className="w-px h-3 bg-white/10 mx-0.5" />
          <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
          <div className="w-2 h-2 rounded-full bg-orange-400/60 ml-0.5" />
        </div>
        <div className="px-3 py-3 space-y-2">
          {NOTE_LINES.slice(0, 2).map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs font-bold line-clamp-1" style={{ color: line.color, textShadow: `0 0 12px ${line.color}60` }}>{line.text}</span>
            </div>
          ))}
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold" style={{ color: NOTE_LINES[2].color, textShadow: `0 0 12px ${NOTE_LINES[2].color}60` }}>
              {NOTE_LINES[2].text.slice(0, typed)}
              <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.55 }}
                className="inline-block w-0.5 h-3 align-middle ml-px" style={{ background: NOTE_LINES[2].color }} />
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm font-medium leading-relaxed">
        Rich-text notes linked to any document, web article, video, or audio.
      </p>
    </BentoCardShell>
  );
};
