import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView, useAnimation } from 'motion/react';

// ─── Typewriter ───────────────────────────────────────────────────────────────
const words = ['Smarter.', 'Faster.', 'Deeper.', 'Better.'];

export const Typewriter: React.FC = () => {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = words[idx];
    if (!deleting && displayed.length < word.length) {
      const t = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 80);
      return () => clearTimeout(t);
    }
    if (!deleting && displayed.length === word.length) {
      const t = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(t);
    }
    if (deleting && displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 45);
      return () => clearTimeout(t);
    }
    if (deleting && displayed.length === 0) {
      setDeleting(false);
      setIdx(i => (i + 1) % words.length);
    }
  }, [displayed, deleting, idx]);

  return (
    <span style={{
      background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 60%, #f0abfc 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    }}>
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }}
        style={{ WebkitTextFillColor: '#22d3ee' }}
      >|</motion.span>
    </span>
  );
};

// ─── Animated counter ─────────────────────────────────────────────────────────
export const Counter: React.FC<{ to: number; suffix?: string; duration?: number }> = ({
  to, suffix = '', duration = 1.8,
}) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / (duration * 1000), 1);
      setVal(Math.floor(prog * to));
      if (prog < 1) requestAnimationFrame(step);
      else setVal(to);
    };
    requestAnimationFrame(step);
  }, [inView, to, duration]);

  return <span ref={ref}>{val}{suffix}</span>;
};

// ─── Particle background ──────────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 28 }).map((_, i) => {
  const seed = (i + 1) * 9301 + 49297;
  const next = (offset: number) => {
    const value = Math.sin(seed + offset * 233) * 10000;
    return value - Math.floor(value);
  };
  return {
    size: next(1) * 2.5 + 0.8,
    x: next(2) * 100,
    y: next(3) * 100,
    dur: next(4) * 14 + 10,
    del: next(5) * 8,
  };
});

export const Particles: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {PARTICLES.map(({ size, x, y, dur, del }, i) => {
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size, height: size,
              left: `${x}%`, top: `${y}%`,
              background: i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#818cf8' : '#f0abfc',
              opacity: 0.35,
            }}
            animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
            transition={{ repeat: Infinity, duration: dur, delay: del, ease: 'easeInOut' }}
          />
        );
      })}
    </div>
  );
};

// ─── Fade in section ──────────────────────────────────────────────────────────
export const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  dir?: 'up' | 'left' | 'right';
}> = ({ children, delay = 0, className = '', dir = 'up' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const inView = useInView(ref, { once: true, margin: '-60px' });

  useEffect(() => { if (inView) controls.start('v'); }, [inView, controls]);

  const hidden = { opacity: 0, y: dir === 'up' ? 40 : 0, x: dir === 'left' ? -40 : dir === 'right' ? 40 : 0 };

  return (
    <motion.div
      ref={ref} initial="h" animate={controls}
      variants={{ h: hidden, v: { opacity: 1, y: 0, x: 0, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
