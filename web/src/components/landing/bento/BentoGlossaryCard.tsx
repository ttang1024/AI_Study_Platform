import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookMarked, Search, ChevronRight } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const TERMS = [
  { term: 'Mitochondria', def: 'Organelle producing ATP via oxidative phosphorylation.' },
  { term: 'ATP Synthase', def: 'Enzyme complex that synthesises ATP from ADP + Pi.' },
  { term: 'Glycolysis', def: 'Metabolic pathway converting glucose to pyruvate.' },
];

export const BentoGlossaryCard: React.FC = () => {
  const [active, setActive] = useState<number | null>(null);

  return (
    <BentoCardShell
      background="rgba(255,255,255,0.025)"
      border="rgba(255,255,255,0.06)"
      hoverShadow="0 0 36px rgba(20,184,166,0.22)"
      hoverBorder="rgba(255,255,255,0.12)"
    >
      <BentoCardHeader
        icon={BookMarked}
        title="Glossary"
        gradient="from-teal-400 via-cyan-500 to-sky-600"
        iconGlow="0 6px 22px rgba(20,184,166,0.35)"
        isNew
      />

      <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <Search className="w-3 h-3 text-white/25" />
          <span className="text-[11px] text-white/20">Search terms…</span>
        </div>
        <div className="divide-y divide-white/5">
          {TERMS.map((t, i) => (
            <div key={i}>
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="text-xs font-semibold" style={{ color: '#5eead4' }}>{t.term}</span>
                <motion.div animate={{ rotate: active === i ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="w-3 h-3 text-white/20" />
                </motion.div>
              </button>
              <AnimatePresence>
                {active === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-3 pb-2.5 text-[11px] leading-relaxed text-white/40">{t.def}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        AI auto-extracts key terms and definitions. A clear, structured knowledge for quick review.
      </p>
    </BentoCardShell>
  );
};
