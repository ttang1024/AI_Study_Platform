import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Volume2, Mic, Play, Pause } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

export const BentoPlayCard: React.FC = () => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(22);
  const progressRef = useRef<NodeJS.Timeout | null>(null);

  const toggle = () => {
    setPlaying(p => {
      if (!p) {
        progressRef.current = setInterval(() => setProgress(v => v >= 100 ? (clearInterval(progressRef.current!), setPlaying(false), 22) : v + 0.6), 60);
      } else {
        if (progressRef.current) clearInterval(progressRef.current);
      }
      return !p;
    });
  };

  useEffect(() => () => { if (progressRef.current) clearInterval(progressRef.current); }, []);

  const bars = [3, 6, 9, 7, 4, 8, 5, 10, 6, 8, 4, 7, 9, 5, 6, 8, 3, 7, 5, 9, 6, 4, 8, 7];

  return (
    <BentoCardShell
      background="rgba(255,255,255,0.025)"
      border="rgba(255,255,255,0.06)"
      hoverShadow="0 0 36px rgba(139,92,246,0.25)"
      hoverBorder="rgba(255,255,255,0.12)"
    >
      <BentoCardHeader
        icon={Volume2}
        title="Play Study Audio"
        gradient="from-teal-500 via-cyan-500 to-sky-600"
        iconGlow="0 6px 22px rgba(13,148,136,0.35)"
      />

      <div className="flex-1 rounded-xl p-4 mb-3 flex flex-col gap-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <Mic className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-xs text-white/50 truncate">Summary · Notes · Glossary</span>
        </div>

        <div className="flex items-end gap-px h-8">
          {bars.map((h, i) => {
            const pct = (i / bars.length) * 100;
            const active = pct <= progress;
            return (
              <motion.div
                key={i}
                className="flex-1 rounded-sm"
                style={{ height: `${(h / 10) * 100}%` }}
                animate={playing && active ? { scaleY: [1, 1.4, 0.8, 1.2, 1] } : { scaleY: 1 }}
                transition={{ repeat: Infinity, duration: 0.6 + i * 0.04, ease: 'easeInOut', delay: i * 0.02 }}
                initial={false}
              >
                <div className="w-full h-full rounded-sm"
                  style={{ background: active ? 'linear-gradient(to top, #059669, #14b8a6)' : 'rgba(255,255,255,0.08)' }} />
              </motion.div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <div className="relative h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${progress}%`, background: 'linear-gradient(to right, #059669, #14b8a6)' }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span>{Math.floor(progress * 0.42)}s</span>
            <span>3:12</span>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggle}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 16px rgba(13,148,136,0.5)' }}
          >
            {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white translate-x-0.5" />}
          </motion.button>
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Listen to summaries, notes, and glossary terms hands-free. A natural voice for quick review.
      </p>
    </BentoCardShell>
  );
};
