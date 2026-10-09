import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { cardStyle, type FeatureTheme } from '../theme';

/** FSRS-4.5 retrievability: the chance of recalling a card t days after a review with stability S. */
const retrievability = (t: number, stability: number) => Math.pow(1 + (19 / 81) * (t / stability), -0.5);

/** Earlier reviews of this card: [review day, stability after it]. With 90% retention, interval = S. */
const HISTORY: [number, number][] = [[0, 1], [1, 3], [4, 13]];
const LAST_REVIEW = 17;

const RATINGS = [
  { label: 'Again', stability: 0.4, next: '10 min', colour: '#64748b' },
  { label: 'Hard', stability: 8, next: '8 days', colour: '#0284c7' },
  { label: 'Good', stability: 22, next: '22 days', colour: '#0d9488' },
  { label: 'Easy', stability: 40, next: '40 days', colour: '#2563eb' },
];

const DAYS = 60;
const W = 420;
const H = 210;
const PAD = { l: 34, r: 22, t: 12, b: 26 };
const x = (day: number) => PAD.l + (day / DAYS) * (W - PAD.l - PAD.r);
const FLOOR = 0.6; // y axis spans 100% down to 60%; a curve that falls further is pinned to the bottom
const y = (r: number) => PAD.t + ((1 - Math.max(r, FLOOR)) / (1 - FLOOR)) * (H - PAD.t - PAD.b);

const curve = (from: number, to: number, stability: number) => {
  const points: string[] = [];
  for (let d = from; d <= to; d += 0.25) points.push(`${x(d).toFixed(1)},${y(retrievability(d - from, stability)).toFixed(1)}`);
  return `M${points.join(' L')}`;
};

export const SpacedRepetitionHero: React.FC<{ theme: FeatureTheme }> = ({ theme }) => {
  const [rating, setRating] = useState(2);
  const chosen = RATINGS[rating];

  const pastPath = useMemo(() => {
    const reviewDays = [...HISTORY.map(([day]) => day), LAST_REVIEW];
    return HISTORY.map(([day, s], i) => curve(day, reviewDays[i + 1], s)).join(' ');
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl p-4 sm:p-5"
      style={{ ...cardStyle(theme), boxShadow: '0 30px 60px -20px rgba(15,23,42,0.22)' }}>
      <div className="flex items-baseline justify-between mb-2 font-mono text-xs" style={{ color: theme.muted }}>
        <span>recall probability · one card</span>
        <span style={{ color: theme.accentText }}>target 90%</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`Forgetting curve. Rating ${chosen.label} schedules the next review in ${chosen.next}.`}>
        {[1, 0.9, 0.8, 0.7, 0.6].map((r) => (
          <g key={r}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(r)} y2={y(r)} stroke={r === 0.9 ? theme.accent : '#e2e8f0'}
              strokeDasharray={r === 0.9 ? '4 4' : undefined} />
            <text x={PAD.l - 6} y={y(r) + 3} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="monospace">{Math.round(r * 100)}%</text>
          </g>
        ))}
        {[0, 15, 30, 45, 60].map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="monospace">day {d}</text>
        ))}

        <path d={pastPath} fill="none" stroke="#93c5fd" strokeWidth="2" />
        <motion.path key={rating} d={curve(LAST_REVIEW, DAYS, chosen.stability)} fill="none" stroke={chosen.colour} strokeWidth="2.5"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} />

        {[...HISTORY.map(([day]) => day).slice(1), LAST_REVIEW].map((day) => (
          <circle key={day} cx={x(day)} cy={y(1)} r="3.5" fill="#3b82f6" />
        ))}
        {chosen.stability >= 1 && (
          <motion.g key={`next-${rating}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <line x1={x(LAST_REVIEW + chosen.stability)} x2={x(LAST_REVIEW + chosen.stability)} y1={y(0.9)} y2={H - PAD.b}
              stroke={chosen.colour} strokeDasharray="2 3" />
            <circle cx={x(LAST_REVIEW + chosen.stability)} cy={y(0.9)} r="4.5" fill={chosen.colour} />
          </motion.g>
        )}
      </svg>

      <p className="font-mono text-sm mt-2 mb-3">
        Day {LAST_REVIEW} review → next in <span style={{ color: chosen.colour }}>{chosen.next}</span>
      </p>
      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map((r, i) => (
          <button key={r.label} type="button" onClick={() => setRating(i)} aria-pressed={i === rating}
            className="rounded-xl py-2 text-sm font-semibold transition-all"
            style={{
              background: i === rating ? r.colour : '#f8fafc',
              color: i === rating ? '#fff' : r.colour,
              border: `1px solid ${i === rating ? r.colour : theme.line}`,
            }}>
            {r.label}
            <span className="block text-[10px] font-mono opacity-80">{r.next}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
