import React from 'react';
import { motion } from 'motion/react';
import { School, KeyRound } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const COURSES = ['Org Chem', 'Cell Bio'];

// `null` is "not started", which the gradebook deliberately renders differently from a real 0%.
const ROWS: { name: string; scores: (number | null)[]; minutes: number }[] = [
  { name: 'Maya R.', scores: [92, 78], minutes: 214 },
  { name: 'Daniel O.', scores: [64, 71], minutes: 138 },
  { name: 'Priya S.', scores: [88, null], minutes: 96 },
];

const scoreColor = (v: number) => (v >= 85 ? '#34d399' : v >= 70 ? '#fbbf24' : '#f87171');

export const BentoClassroomCard: React.FC = () => (
  <BentoCardShell
    background="rgba(99,102,241,0.06)"
    border="rgba(99,102,241,0.2)"
    hoverShadow="0 0 48px rgba(99,102,241,0.24), 0 0 80px rgba(99,102,241,0.10)"
    hoverBorder="rgba(99,102,241,0.42)"
  >
    <BentoCardHeader
      icon={School}
      title="Classrooms & Gradebook"
      gradient="from-indigo-500 to-blue-700"
      iconGlow="0 6px 22px rgba(99,102,241,0.4)"
      isNew
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="inline-flex items-center gap-1.5 mb-2.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
        style={{ background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
        <KeyRound className="w-3 h-3" /> Join code 7K3QDX
      </span>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-semibold text-white/35 uppercase tracking-wide pb-2">Student</th>
            {COURSES.map(c => (
              <th key={c} className="text-right text-[10px] font-semibold text-white/35 uppercase tracking-wide pb-2 pl-2">{c}</th>
            ))}
            <th className="text-right text-[10px] font-semibold text-white/35 uppercase tracking-wide pb-2 pl-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, i) => (
            <motion.tr
              key={r.name}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.14 }}
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <td className="py-1.5 text-[11px] font-semibold text-white/55 whitespace-nowrap">{r.name}</td>
              {r.scores.map((s, j) => (
                <td key={j} className="py-1.5 pl-2 text-right font-mono text-[11px] whitespace-nowrap"
                  style={{ color: s === null ? 'rgba(255,255,255,0.2)' : scoreColor(s) }}>
                  {s === null ? 'not started' : `${s}%`}
                </td>
              ))}
              <td className="py-1.5 pl-2 text-right font-mono text-[11px] text-white/35">{r.minutes}m</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2.5 text-[10px] text-white/25">Drill into any student for their weakest topics and study-time trend</p>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Teachers assign courses with due dates and share a join code. The gradebook tracks quiz scores,
      problems attempted, and time on task per student — no spreadsheet required.
    </p>
  </BentoCardShell>
);
