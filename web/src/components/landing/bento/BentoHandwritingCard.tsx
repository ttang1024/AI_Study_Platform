import React from 'react';
import { motion } from 'motion/react';
import { Camera, CheckCircle2, XCircle } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const STEPS = [
  { text: '2x² − 8x + 6 = 0', ok: true },
  { text: 'x² − 4x + 3 = 0', ok: true },
  { text: '(x − 1)(x + 3) = 0', ok: false },
];

export const BentoHandwritingCard: React.FC = () => (
  <BentoCardShell
    background="rgba(244,63,94,0.06)"
    border="rgba(244,63,94,0.2)"
    hoverShadow="0 0 48px rgba(244,63,94,0.22), 0 0 80px rgba(244,63,94,0.10)"
    hoverBorder="rgba(244,63,94,0.42)"
  >
    <BentoCardHeader
      icon={Camera}
      title="Check My Working"
      gradient="from-rose-500 to-red-600"
      iconGlow="0 6px 22px rgba(244,63,94,0.4)"
      isNew
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] font-semibold text-white/35 mb-2.5 uppercase tracking-wide">Photo of your working, graded step by step</p>
      <div className="space-y-1.5">
        {STEPS.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 + i * 0.3 }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
            style={{ border: `1px solid ${s.ok ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.45)'}` }}
          >
            <span className="font-mono text-[11px]" style={{ color: s.ok ? 'rgba(255,255,255,0.6)' : '#fca5a5' }}>{s.text}</span>
            {s.ok
              ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#34d399' }} />
              : <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f87171' }} />}
          </motion.div>
        ))}
      </div>
      <p className="mt-2 text-[10px]" style={{ color: '#fca5a5' }}>Sign flip when factoring — should be (x − 1)(x − 3)</p>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Photograph a handwritten solution and AI finds where the reasoning first went wrong — not just whether the final answer matched.
    </p>
  </BentoCardShell>
);
