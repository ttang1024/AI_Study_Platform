import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { CalendarDays, CheckCircle2, Circle } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const PLAN_BLOCKS = [
  { time: '09:00', label: 'Review 24 due flashcards', mins: '20m' },
  { time: '14:00', label: 'Mock exam · Cell Biology', mins: '30m' },
  { time: '19:00', label: 'Drill mistakes notebook', mins: '15m' },
];

export const BentoPlannerCard: React.FC = () => {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const iv = setInterval(() => setActive(p => (p + 1) % PLAN_BLOCKS.length), 1600);
    return () => clearInterval(iv);
  }, [inView]);

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(139,92,246,0.06)"
      border="rgba(139,92,246,0.2)"
      hoverShadow="0 0 48px rgba(139,92,246,0.24), 0 0 80px rgba(139,92,246,0.10)"
      hoverBorder="rgba(139,92,246,0.42)"
    >
      <BentoCardHeader
        icon={CalendarDays}
        title="Exam Planner"
        gradient="from-violet-500 to-purple-600"
        iconGlow="0 6px 22px rgba(139,92,246,0.4)"
        right={
          <motion.span
            animate={{ opacity: [1, 0.55, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
          >
            12 days left
          </motion.span>
        }
      />

      <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <CalendarDays className="w-3 h-3 text-violet-400/60" />
          <span className="text-[11px] font-semibold text-white/40 truncate">Biology Final · Jun 23</span>
        </div>
        <div className="px-3 py-2 space-y-1">
          {PLAN_BLOCKS.map((b, i) => (
            <motion.div
              key={i}
              animate={{ opacity: active === i ? 1 : 0.45 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
              style={{ background: active === i ? 'rgba(139,92,246,0.12)' : 'transparent' }}
            >
              {active > i ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#a78bfa' }} />
              ) : (
                <Circle className="w-3.5 h-3.5 flex-shrink-0 text-white/20" />
              )}
              <span className="text-[10px] font-mono text-white/30">{b.time}</span>
              <span className="text-[11px] leading-tight truncate"
                style={{ color: active === i ? '#c4b5fd' : 'rgba(255,255,255,0.4)' }}>
                {b.label}
              </span>
              <span className="ml-auto text-[10px] text-white/25">{b.mins}</span>
            </motion.div>
          ))}
        </div>
        <div className="px-3 pb-2.5">
          <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              initial={{ width: 0 }}
              animate={inView ? { width: '64%' } : {}}
              transition={{ duration: 1, delay: 0.4 }}
              style={{ background: 'linear-gradient(to right, #8b5cf6, #a78bfa)' }}
            />
          </div>
          <span className="text-[10px] text-white/25">Plan 64% complete</span>
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Set an exam date, get a day-by-day study schedule with countdown, and drill timed AI mock exams — wrong answers feed your mistakes notebook.
      </p>
    </BentoCardShell>
  );
};
