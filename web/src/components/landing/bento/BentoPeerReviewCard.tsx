import React from 'react';
import { motion } from 'motion/react';
import { MessagesSquare } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const CRITERIA = [
  { label: 'Thesis', score: 4, of: 5 },
  { label: 'Evidence', score: 3, of: 5 },
  { label: 'Structure', score: 5, of: 5 },
];

export const BentoPeerReviewCard: React.FC = () => (
  <BentoCardShell
    background="rgba(244,114,182,0.06)"
    border="rgba(244,114,182,0.2)"
    hoverShadow="0 0 48px rgba(244,114,182,0.22), 0 0 80px rgba(244,114,182,0.10)"
    hoverBorder="rgba(244,114,182,0.42)"
  >
    <BentoCardHeader
      icon={MessagesSquare}
      title="Peer Review"
      gradient="from-pink-400 to-rose-600"
      iconGlow="0 6px 22px rgba(244,114,182,0.4)"
      isNew
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wide">Reviewer 2 · anonymous</p>
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(244,114,182,0.12)', color: '#f9a8d4' }}>2 of 3 in</span>
      </div>

      <div className="space-y-1.5">
        {CRITERIA.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.12 }}
            className="flex items-center gap-2"
          >
            <span className="text-[10px] text-white/45 w-16 flex-shrink-0">{c.label}</span>
            <div className="flex gap-1">
              {Array.from({ length: c.of }).map((_, d) => (
                <span key={d} className="w-3 h-1.5 rounded-full"
                  style={{ background: d < c.score ? '#f472b6' : 'rgba(255,255,255,0.09)' }} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.65 }}
        className="mt-2.5 pt-2.5 text-[10px] italic leading-relaxed text-white/35"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        “Paragraph 3 asserts the causal link but never sources it — the 1971 study would carry it.”
      </motion.p>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Send a draft to classmates and get it back scored against the same rubric the AI grader uses. Reviews are
      double-blind — authors never see who reviewed them.
    </p>
  </BentoCardShell>
);
