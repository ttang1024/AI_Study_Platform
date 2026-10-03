import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Map } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const MAP_LEAVES = [
  { x: 32, y: 22, label: 'Glycolysis', color: '#34d399' },
  { x: 168, y: 22, label: 'Krebs Cycle', color: '#22d3ee' },
  { x: 32, y: 92, label: 'ATP', color: '#fbbf24' },
  { x: 168, y: 92, label: 'Membrane', color: '#a78bfa' },
];

const MAP_CENTER = { x: 100, y: 57, hw: 36, hh: 10 };
const MAP_LEAF_HALF = { hw: 28, hh: 9 };

// Point where the line from (cx,cy) toward (tx,ty) crosses the border of the
// hw×hh box around (cx,cy) — so connectors stop at node edges instead of
// running through the translucent boxes.
const boxEdgePoint = (cx: number, cy: number, tx: number, ty: number, hw: number, hh: number) => {
  const dx = tx - cx;
  const dy = ty - cy;
  const t = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6));
  return { x: cx + dx * t, y: cy + dy * t };
};

export const BentoMindMapCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(52,211,153,0.06)"
      border="rgba(52,211,153,0.2)"
      hoverShadow="0 0 48px rgba(52,211,153,0.24), 0 0 80px rgba(52,211,153,0.10)"
      hoverBorder="rgba(52,211,153,0.42)"
    >
      <BentoCardHeader
        icon={Map}
        title="Mind Maps"
        gradient="from-emerald-400 via-teal-500 to-cyan-600"
        iconGlow="0 6px 22px rgba(52,211,153,0.4)"
      />

      <div className="flex-1 rounded-xl mb-3 flex items-center justify-center overflow-hidden" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', minHeight: '120px' }}>
        <svg viewBox="0 0 200 114" className="w-full h-full" style={{ maxHeight: 150 }}>
          {MAP_LEAVES.map((leaf, i) => {
            const from = boxEdgePoint(MAP_CENTER.x, MAP_CENTER.y, leaf.x, leaf.y, MAP_CENTER.hw, MAP_CENTER.hh);
            const to = boxEdgePoint(leaf.x, leaf.y, MAP_CENTER.x, MAP_CENTER.y, MAP_LEAF_HALF.hw, MAP_LEAF_HALF.hh);
            return (
              <motion.line
                key={`l${i}`}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={leaf.color} strokeOpacity={0.4} strokeWidth={1}
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.18 }}
              />
            );
          })}
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            style={{ transformOrigin: '100px 57px' }}
          >
            <rect x={64} y={47} width={72} height={20} rx={10} fill="rgba(20,184,166,0.2)" stroke="#2dd4bf" strokeOpacity={0.6} />
            <text x={100} y={60.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#5eead4">Cell Biology</text>
          </motion.g>
          {MAP_LEAVES.map((leaf, i) => (
            <motion.g
              key={`n${i}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.45 + i * 0.18 }}
              style={{ transformOrigin: `${leaf.x}px ${leaf.y}px` }}
            >
              <rect x={leaf.x - 28} y={leaf.y - 9} width={56} height={18} rx={9}
                fill="rgba(0,0,0,0.5)" stroke={leaf.color} strokeOpacity={0.5} />
              <text x={leaf.x} y={leaf.y + 3} textAnchor="middle" fontSize={8} fontWeight={600} fill={leaf.color}>{leaf.label}</text>
            </motion.g>
          ))}
        </svg>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Visualize any document as an interactive mind map — grasp structure at a glance.
      </p>
    </BentoCardShell>
  );
};
