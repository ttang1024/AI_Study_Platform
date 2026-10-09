import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { FeatureTheme } from '../theme';

const W = 460;
const H = 300;
const CENTRE = { x: W / 2, y: H / 2 };

const BRANCHES = [
  { label: 'Light reactions', x: 165, y: 80, colour: '#22d3ee', leaves: ['Thylakoids', 'Water split', 'ATP + NADPH'] },
  { label: 'Calvin cycle', x: 295, y: 80, colour: '#14b8a6', leaves: ['Stroma', 'CO₂ fixed', 'Glucose'] },
  { label: 'Pigments', x: 165, y: 220, colour: '#60a5fa', leaves: ['Chlorophyll a', 'Chlorophyll b', 'Carotenoids'] },
  { label: 'Limiting factors', x: 295, y: 220, colour: '#38bdf8', leaves: ['Light', 'CO₂ level', 'Temperature'] },
];

/** Leaves fan out away from the centre: upper branches spread upwards, lower ones downwards. */
const leafPositions = (branch: (typeof BRANCHES)[number]) => {
  const side = branch.x < CENTRE.x ? 55 : W - 55;
  const offsets = branch.y < CENTRE.y ? [-50, -15, 20] : [-20, 15, 50];
  return offsets.map((dy) => ({ x: side, y: branch.y + dy }));
};

const pillWidth = (text: string, size: number) => text.length * size * 0.56 + 18;

const curve = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  `M${a.x},${a.y} C${(a.x + b.x) / 2},${a.y} ${(a.x + b.x) / 2},${b.y} ${b.x},${b.y}`;

const Pill: React.FC<{ x: number; y: number; text: string; size: number; fill: string; stroke: string; color: string; bold?: boolean }> =
  ({ x, y, text, size, fill, stroke, color, bold }) => {
    const w = pillWidth(text, size);
    const h = size + 12;
    return (
      <g>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={fill} stroke={stroke} />
        <text x={x} y={y + size * 0.35} textAnchor="middle" fontSize={size} fontWeight={bold ? 700 : 500} fill={color}
          fontFamily="Quicksand, sans-serif">{text}</text>
      </g>
    );
  };

export const MindMapHero: React.FC<{ theme: FeatureTheme }> = ({ theme }) => {
  const [open, setOpen] = useState<Set<number>>(() => new Set([0, 1, 2, 3]));

  const toggle = (i: number) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Mind map of photosynthesis">
        {BRANCHES.map((b, i) => (
          <motion.path key={b.label} d={curve(CENTRE, b)} fill="none" stroke={b.colour} strokeWidth="3" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2 + i * 0.12, duration: 0.6 }} />
        ))}

        <AnimatePresence>
          {BRANCHES.map((b, i) => open.has(i) && leafPositions(b).map((leaf, j) => (
            <motion.g key={`${b.label}-${j}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.7 + j * 0.08 }}>
              <path d={curve(b, leaf)} fill="none" stroke={b.colour} strokeOpacity="0.55" strokeWidth="1.5" />
              <Pill x={leaf.x} y={leaf.y} text={b.leaves[j]} size={10} fill="#ffffff" stroke={`${b.colour}99`} color="#334155" />
            </motion.g>
          )))}
        </AnimatePresence>

        {BRANCHES.map((b, i) => (
          <motion.g key={b.label} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.12 }} style={{ transformOrigin: `${b.x}px ${b.y}px`, cursor: 'pointer' }}
            onClick={() => toggle(i)} role="button" aria-expanded={open.has(i)} aria-label={`${b.label} branch`}>
            <Pill x={b.x} y={b.y} text={b.label} size={12} fill={b.colour} stroke={b.colour} color="#03202b" bold />
          </motion.g>
        ))}

        <Pill x={CENTRE.x} y={CENTRE.y} text="Photosynthesis" size={15} fill="#ffffff" stroke={theme.accent} color="#134e4a" bold />
      </svg>
      <p className="text-center text-xs mt-1" style={{ color: theme.muted }}>Click a branch to fold it away</p>
    </div>
  );
};
