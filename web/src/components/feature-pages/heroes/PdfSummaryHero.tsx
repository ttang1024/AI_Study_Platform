import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type { FeatureTheme } from '../theme';

/** Widths of the grey "text" lines on the mock page; `true` marks a line the summary draws on. */
const LINES: [number, boolean][] = [
  [92, false], [86, true], [95, false], [70, false], [0, false],
  [90, false], [94, true], [88, true], [60, false], [0, false],
  [93, false], [85, false], [91, true], [52, false],
];

const SUMMARY = [
  'Inflation is a sustained rise in the general price level.',
  'Central banks raise interest rates to slow demand.',
  'Higher rates cool borrowing, spending and, in time, prices.',
  'The trade-off is slower growth and higher unemployment.',
];

export const PdfSummaryHero: React.FC<{ theme: FeatureTheme }> = ({ theme }) => {
  // Bumping the run key replays the highlight and summary animation.
  const [run, setRun] = useState(0);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="relative rounded-sm bg-white p-6 pb-8 rotate-[-1.5deg] w-[78%]"
        style={{ border: '1px solid #e7e5e4', boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 18px 40px -12px rgba(15,23,42,0.22)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold tracking-widest text-stone-400">ECON 101 · LECTURE 7</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">PDF</span>
        </div>
        <div className="h-3 w-2/3 rounded bg-stone-800/80 mb-4" />
        <div className="space-y-2">
          {LINES.map(([width, key], i) =>
            width === 0 ? <div key={i} className="h-2" /> : (
              <div key={`${run}-${i}`} className="relative h-2 rounded-full bg-stone-200" style={{ width: `${width}%` }}>
                {key && (
                  <motion.div className="absolute -inset-y-1 left-0 rounded" style={{ background: theme.accentSoft }}
                    initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }} />
                )}
              </div>
            ),
          )}
        </div>
      </div>

      <motion.div key={run} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.5 }}
        className="relative -mt-36 ml-auto w-[72%] rounded-xl p-5 rotate-[1.5deg]"
        style={{ background: '#ecfeff', border: '1px solid rgba(8,145,178,0.3)', boxShadow: '0 18px 40px -12px rgba(15,118,110,0.3)' }}>
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-3 text-teal-700">
          <Sparkles className="w-3.5 h-3.5" /> Summary
        </p>
        <ul className="space-y-2">
          {SUMMARY.map((point, i) => (
            <motion.li key={point} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1 + i * 0.15 }}
              className="flex gap-2 text-sm leading-snug text-stone-700" style={{ fontFamily: theme.headingFont }}>
              <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full" style={{ background: theme.accent }} />
              {point}
            </motion.li>
          ))}
        </ul>
      </motion.div>

      <button type="button" onClick={() => setRun((r) => r + 1)}
        className="mt-5 ml-auto flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border"
        style={{ color: theme.accentText, borderColor: theme.line, background: theme.surface, boxShadow: theme.cardShadow }}>
        <Sparkles className="w-3.5 h-3.5" /> Summarise again
      </button>
    </div>
  );
};
