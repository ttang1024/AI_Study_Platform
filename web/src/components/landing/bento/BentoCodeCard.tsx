import React from 'react';
import { motion } from 'motion/react';
import { Terminal, Check } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const CODE = [
  { text: 'def fib(n):', indent: 0 },
  { text: 'a, b = 0, 1', indent: 1 },
  { text: 'for _ in range(n):', indent: 1 },
  { text: 'a, b = b, a + b', indent: 2 },
  { text: 'return a', indent: 1 },
];

export const BentoCodeCard: React.FC = () => (
  <BentoCardShell
    background="rgba(132,204,22,0.06)"
    border="rgba(132,204,22,0.2)"
    hoverShadow="0 0 48px rgba(132,204,22,0.22), 0 0 80px rgba(132,204,22,0.10)"
    hoverBorder="rgba(132,204,22,0.42)"
  >
    <BentoCardHeader
      icon={Terminal}
      title="Runnable Code"
      gradient="from-lime-400 to-emerald-600"
      iconGlow="0 6px 22px rgba(132,204,22,0.4)"
      isNew
    />

    <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
        <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(248,113,113,0.6)' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(251,191,36,0.6)' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(52,211,153,0.6)' }} />
        <span className="ml-1.5 text-[10px] text-white/25">exercise.py</span>
      </div>

      <div className="px-3 py-2.5 space-y-0.5">
        {CODE.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.09 }}
            className="font-mono text-[11px] text-white/55 whitespace-pre"
          >
            {'  '.repeat(line.indent)}{line.text}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.75 }}
        className="flex items-center gap-1.5 px-3 py-2 border-t border-white/5"
      >
        <Check className="w-3 h-3 flex-shrink-0" style={{ color: '#a3e635' }} />
        <span className="font-mono text-[10px]" style={{ color: '#a3e635' }}>3 / 3 tests passed</span>
        <span className="ml-auto text-[9px] text-white/25">ran locally · 0.4s</span>
      </motion.div>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Practice sets can include Python cells you actually run, checked against hidden tests. Execution happens
      entirely in your browser — your code never leaves the tab.
    </p>
  </BentoCardShell>
);
