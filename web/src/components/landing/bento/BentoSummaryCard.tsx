import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { ScrollText, FileText, Youtube, Mic, Globe } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const SOURCES = [
  { icon: FileText, label: 'PDF' },
  { icon: Youtube, label: 'Video' },
  { icon: Mic, label: 'Podcast' },
  { icon: Globe, label: 'Article' },
];

const POINTS = [
  'Cells convert glucose into ATP in three stages',
  'Glycolysis splits glucose into two pyruvate',
  'The electron transport chain yields most of the ATP',
];

export const BentoSummaryCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(56,189,248,0.06)"
      border="rgba(56,189,248,0.2)"
      hoverShadow="0 0 48px rgba(56,189,248,0.24), 0 0 80px rgba(56,189,248,0.10)"
      hoverBorder="rgba(56,189,248,0.42)"
    >
      <BentoCardHeader
        icon={ScrollText}
        title="AI Summaries"
        gradient="from-sky-500 via-cyan-500 to-blue-600"
        iconGlow="0 6px 22px rgba(56,189,248,0.4)"
      />

      <div className="flex-1 rounded-xl p-3 mb-3 flex flex-col gap-2.5" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCES.map(({ icon: Icon, label }, i) => (
            <motion.span
              key={label}
              initial={{ opacity: 0, y: -4 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(56,189,248,0.1)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.25)' }}
            >
              <Icon className="w-2.5 h-2.5" /> {label}
            </motion.span>
          ))}
        </div>

        {/* the summary streams in token by token, so the bar fills as the bullets land */}
        <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: '0%' }}
            animate={inView ? { width: '100%' } : {}}
            transition={{ duration: 1.6, delay: 0.35, ease: 'easeInOut' }}
            className="h-full"
            style={{ background: 'linear-gradient(90deg, #38bdf8, #22d3ee)' }}
          />
        </div>

        <div className="space-y-1.5">
          {POINTS.map((p, i) => (
            <motion.div
              key={p}
              initial={{ opacity: 0, x: -6 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.5 + i * 0.4 }}
              className="flex items-start gap-2"
            >
              <span className="w-1 h-1 rounded-full flex-shrink-0 mt-[7px]" style={{ background: '#38bdf8' }} />
              <span className="text-[11px] leading-relaxed text-white/55">{p}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Drop in a document, video, podcast, or web article and get a structured summary that streams in as it is written.
      </p>
    </BentoCardShell>
  );
};
