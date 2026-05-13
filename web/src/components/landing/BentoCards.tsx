import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import {
  CreditCard, PenLine, Volume2, BookMarked, FlaskConical, Users,
  MessageCircle, Lock, ChevronRight, Search, RotateCcw,
  ThumbsUp, ThumbsDown, Minus, CheckCircle2, Circle,
  Play, Pause, Mic,
} from 'lucide-react';

// ─── Flashcard bento card ────────────────────────────────────────────────────
const REVIEW_STATS = [
  { label: 'New', value: 12, color: '#38bdf8' },
  { label: 'Review', value: 8, color: '#fb923c' },
  { label: 'Known', value: 34, color: '#34d399' },
];

const CARDS = [
  { q: 'What is the powerhouse of the cell?', a: 'The mitochondrion — it produces ATP through oxidative phosphorylation.' },
  { q: 'Define osmosis.', a: 'Movement of water across a semipermeable membrane from low to high solute concentration.' },
  { q: 'What does DNA stand for?', a: 'Deoxyribonucleic acid — the molecule carrying genetic instructions.' },
];

export const BentoFlashcardCard: React.FC = () => {
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);

  const advance = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCardIdx(i => (i + 1) % CARDS.length);
      setFlipped(false);
      setAnimating(false);
    }, 220);
  };

  const card = CARDS[cardIdx];

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col p-6 rounded-2xl h-full cursor-default"
      style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.2)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 48px rgba(251,146,60,0.24), 0 0 80px rgba(251,146,60,0.10)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(251,146,60,0.42)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(251,146,60,0.2)';
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500"
            style={{ boxShadow: '0 6px 22px rgba(251,146,60,0.4)' }}
          >
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-white">AI Flashcards</h3>
        </div>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}
        >
          {cardIdx + 1} / {CARDS.length}
        </span>
      </div>

      <div
        className="flex-1 rounded-xl mb-3 relative overflow-hidden cursor-pointer select-none"
        style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', minHeight: '100px', perspective: '800px' }}
        onClick={() => !animating && setFlipped(f => !f)}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0, opacity: animating ? 0 : 1 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%', position: 'relative' }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 py-4" style={{ backfaceVisibility: 'hidden' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Question</span>
            <p className="text-sm font-semibold text-white/80 text-center leading-snug">{card.q}</p>
            <div className="flex items-center gap-1 mt-1">
              <RotateCcw className="w-3 h-3 text-white/20" />
              <span className="text-[10px] text-white/20">tap to reveal</span>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 py-4" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#fb923c' }}>Answer</span>
            <p className="text-xs text-white/70 text-center leading-relaxed">{card.a}</p>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={advance}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:bg-red-500/20"
          style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <ThumbsDown className="w-3 h-3" /> Again
        </button>
        <button onClick={advance}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:bg-amber-500/20"
          style={{ border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c' }}>
          <Minus className="w-3 h-3" /> Hard
        </button>
        <button onClick={advance}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:bg-emerald-500/20"
          style={{ border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
          <ThumbsUp className="w-3 h-3" /> Good
        </button>
      </div>
    </motion.div>
  );
};

// ─── Notes bento card ─────────────────────────────────────────────────────────
const NOTE_LINES = [
  { text: 'Mitochondria are the powerhouse of the cell.', color: '#22d3ee' },
  { text: 'ATP synthesis drives cellular respiration.', color: '#a78bfa' },
  { text: 'Key enzymes: citrate synthase, NADH dehydrogenase', color: '#fbbf24' },
];

export const BentoNoteCard: React.FC = () => {
  const [typed, setTyped] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const target = NOTE_LINES[2].text.length;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(i);
      if (i >= target) clearInterval(iv);
    }, 38);
    return () => clearInterval(iv);
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col p-6 rounded-2xl h-full cursor-default"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 48px rgba(251,191,36,0.35), 0 0 80px rgba(251,191,36,0.12)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(251,191,36,0.4)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(251,191,36,0.18)';
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-yellow-400 via-orange-400 to-rose-500"
          style={{ boxShadow: '0 6px 22px rgba(251,191,36,0.35)' }}
        >
          <PenLine className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-base font-bold text-white">Notes</h3>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          {['B', 'I', 'U'].map(l => (
            <button key={l} className="text-[10px] font-bold w-5 h-5 rounded text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">{l}</button>
          ))}
          <div className="w-px h-3 bg-white/10 mx-0.5" />
          <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
          <div className="w-2 h-2 rounded-full bg-orange-400/60 ml-0.5" />
        </div>
        <div className="px-3 py-3 space-y-2">
          {NOTE_LINES.slice(0, 2).map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs font-bold line-clamp-1" style={{ color: line.color, textShadow: `0 0 12px ${line.color}60` }}>{line.text}</span>
            </div>
          ))}
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold" style={{ color: NOTE_LINES[2].color, textShadow: `0 0 12px ${NOTE_LINES[2].color}60` }}>
              {NOTE_LINES[2].text.slice(0, typed)}
              <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.55 }}
                className="inline-block w-0.5 h-3 align-middle ml-px" style={{ background: NOTE_LINES[2].color }} />
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm font-medium leading-relaxed">
        Rich-text notes linked to any document, web article, video, or audio.
      </p>
    </motion.div>
  );
};

// ─── Play study audio bento card ──────────────────────────────────────────────
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
    <motion.div
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col p-6 rounded-2xl h-full cursor-default"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 36px rgba(139,92,246,0.25)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-600"
          style={{ boxShadow: '0 6px 22px rgba(13,148,136,0.35)' }}
        >
          <Volume2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-white">Play Study Audio</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(240,171,252,0.15)', color: '#f0abfc', border: '1px solid rgba(240,171,252,0.3)' }}>NEW</span>
        </div>
      </div>

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
        Listen to summaries, notes, and glossary terms hands-free. AI narrates with a natural voice for quick review.
      </p>
    </motion.div>
  );
};

// ─── Glossary bento card ──────────────────────────────────────────────────────
const TERMS = [
  { term: 'Mitochondria', def: 'Organelle producing ATP via oxidative phosphorylation.' },
  { term: 'ATP Synthase', def: 'Enzyme complex that synthesises ATP from ADP + Pi.' },
  { term: 'Glycolysis', def: 'Metabolic pathway converting glucose to pyruvate.' },
];

export const BentoGlossaryCard: React.FC = () => {
  const [active, setActive] = useState<number | null>(null);

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col p-6 rounded-2xl h-full cursor-default"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 36px rgba(20,184,166,0.22)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.12)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)';
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-teal-400 via-cyan-500 to-sky-600"
          style={{ boxShadow: '0 6px 22px rgba(20,184,166,0.35)' }}
        >
          <BookMarked className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-white">Glossary</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(240,171,252,0.15)', color: '#f0abfc', border: '1px solid rgba(240,171,252,0.3)' }}>NEW</span>
        </div>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <Search className="w-3 h-3 text-white/25" />
          <span className="text-[11px] text-white/20">Search terms…</span>
        </div>
        <div className="divide-y divide-white/5">
          {TERMS.map((t, i) => (
            <div key={i}>
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="text-xs font-semibold" style={{ color: '#5eead4' }}>{t.term}</span>
                <motion.div animate={{ rotate: active === i ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="w-3 h-3 text-white/20" />
                </motion.div>
              </button>
              <AnimatePresence>
                {active === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-3 pb-2.5 text-[11px] leading-relaxed text-white/40">{t.def}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        AI auto-extracts key terms and definitions. A clear, structured knowledge for quick review.
      </p>
    </motion.div>
  );
};

// ─── Problem solver bento card ────────────────────────────────────────────────
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
    <motion.div
      ref={ref}
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col p-6 rounded-2xl h-full cursor-default"
      style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 48px rgba(16,185,129,0.24), 0 0 80px rgba(16,185,129,0.10)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(16,185,129,0.42)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(16,185,129,0.2)';
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600"
          style={{ boxShadow: '0 6px 22px rgba(16,185,129,0.4)' }}
        >
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-white">Problems</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(240,171,252,0.15)', color: '#f0abfc', border: '1px solid rgba(240,171,252,0.3)' }}>NEW</span>
        </div>
      </div>

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
    </motion.div>
  );
};

// ─── Study Group bento card ───────────────────────────────────────────────────
const GROUP_MEMBERS = [
  { name: 'Alice', color: '#22d3ee', role: 'Added 3 flashcards' },
  { name: 'Bob', color: '#a78bfa', role: 'Shared Mind Map' },
  { name: 'Carol', color: '#34d399', role: 'Scored 95% on quiz' },
  { name: 'Dave', color: '#fb923c', role: 'Posted a note' },
];

export const BentoStudyGroupCard: React.FC = () => {
  const [highlight, setHighlight] = useState<number | null>(null);

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="relative flex flex-col p-6 rounded-2xl h-full cursor-default"
      style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 48px rgba(99,102,241,0.28), 0 0 80px rgba(99,102,241,0.10)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.42)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.2)';
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-600"
          style={{ boxShadow: '0 6px 22px rgba(13,148,136,0.4)' }}
        >
          <Users className="w-5 h-5 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-white">Study Groups</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(240,171,252,0.15)', color: '#f0abfc', border: '1px solid rgba(240,171,252,0.3)' }}>NEW</span>
        </div>
      </div>

      <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-white/25" />
            <span className="text-[11px] font-semibold text-white/40">Biology 101</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-teal-400/60" />
            <span className="text-[10px] text-white/25">4 members</span>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {GROUP_MEMBERS.map((m, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2.5 px-3 py-2 transition-colors"
              style={{ background: highlight === i ? 'rgba(255,255,255,0.04)' : 'transparent' }}
              onMouseEnter={() => setHighlight(i)}
              onMouseLeave={() => setHighlight(null)}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44` }}
              >
                {m.name[0]}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-white/70">{m.name}</span>
                <span className="text-[10px] text-white/30 ml-1.5">{m.role}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Create or join study groups. Share documents, quizzes, and flashcards — learn together.
      </p>
    </motion.div>
  );
};
