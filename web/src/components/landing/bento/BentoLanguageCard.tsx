import React from 'react';
import { motion } from 'motion/react';
import { Languages, Mic, Plus } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const WORDS = [
  { text: 'Je', ok: true },
  { text: 'voudrais', ok: false },
  { text: 'un', ok: true },
  { text: 'café', ok: true },
];

export const BentoLanguageCard: React.FC = () => (
  <BentoCardShell
    background="rgba(59,130,246,0.06)"
    border="rgba(59,130,246,0.2)"
    hoverShadow="0 0 48px rgba(59,130,246,0.24), 0 0 80px rgba(59,130,246,0.10)"
    hoverBorder="rgba(59,130,246,0.42)"
  >
    <BentoCardHeader
      icon={Languages}
      title="Language Practice"
      gradient="from-blue-500 to-cyan-600"
      iconGlow="0 6px 22px rgba(59,130,246,0.4)"
      isNew
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/35 uppercase tracking-wide">
          <Mic className="w-3 h-3" style={{ color: '#93c5fd' }} /> You said
        </span>
        <span className="font-mono text-[11px] font-bold" style={{ color: '#60a5fa' }}>82%</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {WORDS.map((w, i) => (
          <motion.span
            key={w.text}
            initial={{ opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.12 }}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg"
            style={{
              background: w.ok ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.12)',
              color: w.ok ? 'rgba(255,255,255,0.6)' : '#fcd34d',
              border: `1px solid ${w.ok ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.4)'}`,
            }}
          >
            {w.text}
          </motion.span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/25">“voudrais” — the final s stays silent</p>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.8 }}
        className="mt-3 pt-2.5 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Plus className="w-3 h-3 flex-shrink-0" style={{ color: '#93c5fd' }} />
        <span className="text-[10px] text-white/40 truncate">Mine a sentence you met → flashcard</span>
      </motion.div>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Say a phrase and have your pronunciation scored word by word, or turn any sentence you ran into out in the
      wild into a review card that joins your normal spaced-repetition queue.
    </p>
  </BentoCardShell>
);
