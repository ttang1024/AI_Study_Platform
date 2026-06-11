import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Trophy, CheckCircle2, XCircle } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const QUIZ_OPTIONS = ['Nucleus', 'Mitochondria', 'Ribosome'];
const QUIZ_CORRECT = 1;

export const BentoQuizCard: React.FC = () => {
  const [picked, setPicked] = useState<number | null>(null);
  const resetRef = useRef<NodeJS.Timeout | null>(null);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    resetRef.current = setTimeout(() => setPicked(null), 2200);
  };

  useEffect(() => () => { if (resetRef.current) clearTimeout(resetRef.current); }, []);

  return (
    <BentoCardShell
      background="rgba(217,70,239,0.06)"
      border="rgba(217,70,239,0.2)"
      hoverShadow="0 0 48px rgba(217,70,239,0.24), 0 0 80px rgba(217,70,239,0.10)"
      hoverBorder="rgba(217,70,239,0.42)"
    >
      <BentoCardHeader
        icon={Trophy}
        title="AI Quizzes"
        gradient="from-fuchsia-500 to-pink-600"
        iconGlow="0 6px 22px rgba(217,70,239,0.4)"
        right={
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(217,70,239,0.15)', color: '#e879f9', border: '1px solid rgba(217,70,239,0.3)' }}>
            Q 3 / 10
          </span>
        }
      />

      <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-semibold text-white/75 mb-2.5">Which organelle produces ATP?</p>
        <div className="space-y-1.5">
          {QUIZ_OPTIONS.map((opt, i) => {
            const answered = picked !== null;
            const isCorrect = i === QUIZ_CORRECT;
            const isPicked = i === picked;
            const border = answered && isCorrect ? 'rgba(52,211,153,0.6)'
              : answered && isPicked ? 'rgba(248,113,113,0.6)'
              : 'rgba(255,255,255,0.1)';
            const color = answered && isCorrect ? '#34d399'
              : answered && isPicked ? '#f87171'
              : 'rgba(255,255,255,0.55)';
            return (
              <motion.button
                key={i}
                onClick={() => pick(i)}
                whileHover={picked === null ? { x: 2 } : {}}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors"
                style={{ border: `1px solid ${border}`, color, background: answered && (isCorrect || isPicked) ? 'rgba(255,255,255,0.03)' : 'transparent' }}
              >
                <span className="text-[11px] font-semibold">{String.fromCharCode(65 + i)}. {opt}</span>
                {answered && isCorrect && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#34d399' }} />}
                {answered && isPicked && !isCorrect && <XCircle className="w-3.5 h-3.5" style={{ color: '#f87171' }} />}
              </motion.button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-white/25">
          {picked === null ? 'Tap an answer to check it'
            : picked === QUIZ_CORRECT ? 'Correct! +10 XP'
            : 'Added to your mistakes notebook'}
        </p>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Question Bank with filtering &amp; pagination, Review Mistakes tab, timed mock exam, and shareable quiz links.
      </p>
    </BentoCardShell>
  );
};
