import React from 'react';
import { motion } from 'motion/react';
import { Target, Play, RotateCcw, BrainCircuit, Award } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const SESSION_ITEMS = [
  { icon: BrainCircuit, label: '12 due flashcards', color: '#2dd4bf' },
  { icon: RotateCcw, label: '4 mistakes to redo', color: '#f87171' },
  { icon: Award, label: '6 weak-concept questions', color: '#fbbf24' },
];

export const BentoPracticeCard: React.FC = () => (
  <BentoCardShell
    background="rgba(245,158,11,0.06)"
    border="rgba(245,158,11,0.2)"
    hoverShadow="0 0 48px rgba(245,158,11,0.22), 0 0 80px rgba(245,158,11,0.10)"
    hoverBorder="rgba(245,158,11,0.42)"
  >
    <BentoCardHeader
      icon={Target}
      title="Practice Center"
      gradient="from-amber-500 to-orange-600"
      iconGlow="0 6px 22px rgba(245,158,11,0.4)"
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-white/75">Daily smart session</span>
        <motion.span
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 2.4 }}
          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.35)' }}
        >
          <Play className="w-2.5 h-2.5" /> Start now
        </motion.span>
      </div>
      <div className="space-y-1.5">
        {SESSION_ITEMS.map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
            <span className="text-[11px] font-semibold text-white/55">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/25">Auto-picked and interleaved into one short session</p>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      One button builds today's session from due reviews, past mistakes, and weak concepts — or configure your own test mixing quizzes, flashcards, glossary, and worked problems.
    </p>
  </BentoCardShell>
);
