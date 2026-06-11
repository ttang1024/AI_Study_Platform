import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const WEEK_MINUTES = [34, 52, 41, 68, 57, 80, 63];
const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const BentoInsightsCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(245,158,11,0.06)"
      border="rgba(245,158,11,0.2)"
      hoverShadow="0 0 48px rgba(245,158,11,0.24), 0 0 80px rgba(245,158,11,0.10)"
      hoverBorder="rgba(245,158,11,0.42)"
    >
      <BentoCardHeader
        icon={BarChart3}
        title={<>Insights &amp; Analytics</>}
        gradient="from-amber-400 to-orange-600"
        iconGlow="0 6px 22px rgba(245,158,11,0.4)"
      />

      <div className="flex-1 rounded-xl p-3 mb-3 flex flex-col gap-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/40">Study minutes · this week</span>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" style={{ color: '#34d399' }} />
            <span className="text-[10px] font-bold" style={{ color: '#34d399' }}>+18%</span>
          </div>
        </div>

        <div className="flex items-end gap-1.5 h-16 flex-1">
          {WEEK_MINUTES.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <motion.div
                className="w-full rounded-t-sm"
                initial={{ height: 0 }}
                animate={inView ? { height: `${(m / 80) * 100}%` } : {}}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.08, ease: 'easeOut' }}
                style={{
                  background: i === 5
                    ? 'linear-gradient(to top, #d97706, #fbbf24)'
                    : 'rgba(251,191,36,0.25)',
                  boxShadow: i === 5 ? '0 0 14px rgba(251,191,36,0.4)' : 'none',
                }}
              />
              <span className="text-[9px] text-white/25">{WEEK_DAYS[i]}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="flex-1 text-center text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
            Mastery 78%
          </span>
          <span className="flex-1 text-center text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)' }}>
            Level 7 · 2,340 XP
          </span>
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Time-on-task, accuracy trends, per-course mastery, knowledge-gap detection, XP levels — plus AI recommendations on what to study next.
      </p>
    </BentoCardShell>
  );
};
