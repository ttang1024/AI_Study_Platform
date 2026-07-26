import React from 'react';
import { motion } from 'motion/react';
import { Network } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const NODES = [
  { x: 100, y: 20, r: 11, label: 'Metabolism', color: '#34d399' },
  { x: 34, y: 62, r: 8, label: 'PDF', color: '#22d3ee' },
  { x: 100, y: 92, r: 8, label: 'Quiz', color: '#a78bfa' },
  { x: 166, y: 58, r: 8, label: 'Gap', color: '#f87171' },
];

export const BentoKnowledgeGraphCard: React.FC = () => (
  <BentoCardShell
    background="rgba(16,185,129,0.06)"
    border="rgba(16,185,129,0.2)"
    hoverShadow="0 0 48px rgba(16,185,129,0.22), 0 0 80px rgba(16,185,129,0.10)"
    hoverBorder="rgba(16,185,129,0.42)"
  >
    <BentoCardHeader
      icon={Network}
      title="Knowledge Graph"
      gradient="from-emerald-500 to-teal-600"
      iconGlow="0 6px 22px rgba(16,185,129,0.4)"
    />

    <div className="flex-1 rounded-xl p-3 mb-3 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <svg viewBox="0 0 200 120" className="w-full max-w-[220px]">
        {NODES.slice(1).map((n, i) => (
          <motion.line
            key={i}
            x1={NODES[0].x} y1={NODES[0].y} x2={n.x} y2={n.y}
            stroke={n.color} strokeWidth={1} strokeOpacity={0.35}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 + i * 0.15 }}
          />
        ))}
        {NODES.map((n, i) => (
          <motion.g key={i}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 + i * 0.12 }}
          >
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} fillOpacity={0.16} stroke={n.color} strokeWidth={1.2} />
            <text x={n.x} y={n.y + n.r + 11} textAnchor="middle" fontSize={8} fontWeight={600} fill={n.color}>{n.label}</text>
          </motion.g>
        ))}
      </svg>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      A cross-material concept map connecting concepts, notes, quizzes, flashcards, and materials across courses — with your knowledge gaps highlighted.
    </p>
  </BentoCardShell>
);
