import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, MessageCircle, Lock } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const GROUP_MEMBERS = [
  { name: 'Alice', color: '#22d3ee', role: 'Added 3 flashcards' },
  { name: 'Bob', color: '#a78bfa', role: 'Shared Mind Map' },
  { name: 'Carol', color: '#34d399', role: 'Scored 95% on quiz' },
  { name: 'Dave', color: '#fb923c', role: 'Posted a note' },
];

export const BentoStudyGroupCard: React.FC = () => {
  const [highlight, setHighlight] = useState<number | null>(null);

  return (
    <BentoCardShell
      background="rgba(99,102,241,0.06)"
      border="rgba(99,102,241,0.2)"
      hoverShadow="0 0 48px rgba(99,102,241,0.28), 0 0 80px rgba(99,102,241,0.10)"
      hoverBorder="rgba(99,102,241,0.42)"
    >
      <BentoCardHeader
        icon={Users}
        title="Study Groups"
        gradient="from-teal-500 via-cyan-500 to-sky-600"
        iconGlow="0 6px 22px rgba(13,148,136,0.4)"
      />

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
        Create or join study groups. Study together in live co-study rooms with a shared focus timer — share courses, assign work, battle in live quizzes, and climb the XP leaderboard.
      </p>
    </BentoCardShell>
  );
};
