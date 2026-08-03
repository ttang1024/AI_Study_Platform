import React from 'react';
import { motion } from 'motion/react';
import { PenTool } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const CRITERIA = [
  { name: 'Thesis', score: 8, max: 10 },
  { name: 'Evidence', score: 6, max: 10 },
  { name: 'Structure', score: 9, max: 10 },
];

export const BentoEssayCard: React.FC = () => (
  <BentoCardShell
    background="rgba(168,85,247,0.06)"
    border="rgba(168,85,247,0.2)"
    hoverShadow="0 0 48px rgba(168,85,247,0.24), 0 0 80px rgba(168,85,247,0.10)"
    hoverBorder="rgba(168,85,247,0.42)"
  >
    <BentoCardHeader
      icon={PenTool}
      title="Essay Grading"
      gradient="from-purple-500 to-fuchsia-600"
      iconGlow="0 6px 22px rgba(168,85,247,0.4)"
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold text-white/35 uppercase tracking-wide">Graded against your rubric</span>
        <span className="font-mono text-[11px] font-bold" style={{ color: '#d8b4fe' }}>77%</span>
      </div>

      <div className="space-y-2">
        {CRITERIA.map((c, i) => (
          <div key={c.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-white/55">{c.name}</span>
              <span className="font-mono text-[10px] text-white/35">{c.score}/{c.max}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${(c.score / c.max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.2 + i * 0.15, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #a855f7, #e879f9)' }}
              />
            </div>
          </div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.75 }}
        className="mt-3 pt-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p className="text-[10px] leading-relaxed text-white/40">
          <span className="italic text-white/30">“…rates rose sharply in the period.”</span>{' '}
          <span style={{ color: '#d8b4fe' }}>Name the period and cite the figure — this claim carries the paragraph.</span>
        </p>
      </motion.div>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Write against a rubric you define and get a score per criterion, with every comment quoted from your own
      draft. Revise and re-submit — each version is kept so you can see the essay improve.
    </p>
  </BentoCardShell>
);
