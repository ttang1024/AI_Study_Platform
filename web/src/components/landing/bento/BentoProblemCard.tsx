import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { FlaskConical, CheckCircle2, Circle } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const PROBLEM_STEPS = [
  { label: 'Understand the problem', done: true },
  { label: 'Break into sub-problems', done: true },
  { label: 'Solve each step with AI hints', done: false },
  { label: 'Verify & explain solution', done: false },
];

export const BentoProblemCard: React.FC = () => {
  const [active, setActive] = useState(2);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const iv = setInterval(() => {
      setActive(p => (p + 1) % PROBLEM_STEPS.length);
    }, 1600);
    return () => clearInterval(iv);
  }, [inView]);

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(16,185,129,0.06)"
      border="rgba(16,185,129,0.2)"
      hoverShadow="0 0 48px rgba(16,185,129,0.24), 0 0 80px rgba(16,185,129,0.10)"
      hoverBorder="rgba(16,185,129,0.42)"
    >
      <BentoCardHeader
        icon={FlaskConical}
        title="Problems"
        gradient="from-emerald-400 via-green-500 to-teal-600"
        iconGlow="0 6px 22px rgba(16,185,129,0.4)"
      />

      <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <FlaskConical className="w-3 h-3 text-emerald-400/60" />
          <span className="text-[11px] font-semibold text-white/40 truncate">Solve: Ideal Gas Law</span>
        </div>
        <div className="px-3 py-2 space-y-1">
          {PROBLEM_STEPS.map((s, i) => (
            <motion.div
              key={i}
              animate={{ opacity: active === i ? 1 : 0.45 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg"
              style={{ background: active === i ? 'rgba(16,185,129,0.10)' : 'transparent' }}
            >
              {s.done || active > i ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#34d399' }} />
              ) : (
                <Circle className="w-3.5 h-3.5 flex-shrink-0 text-white/20" />
              )}
              <span
                className="text-[11px] leading-tight"
                style={{ color: active === i ? '#6ee7b7' : s.done || active > i ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)' }}
              >
                {s.label}
              </span>
              {active === i && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  className="ml-auto text-[10px] font-semibold"
                  style={{ color: '#34d399' }}
                >
                  AI ▋
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Tackle any problem step by step — AI guides you through each stage and explains the reasoning.
      </p>
    </BentoCardShell>
  );
};
