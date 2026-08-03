import React from 'react';
import { motion } from 'motion/react';
import { Quote, ExternalLink, AlertTriangle } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

export const BentoCitationCard: React.FC = () => (
  <BentoCardShell
    background="rgba(251,191,36,0.06)"
    border="rgba(251,191,36,0.2)"
    hoverShadow="0 0 48px rgba(251,191,36,0.22), 0 0 80px rgba(251,191,36,0.10)"
    hoverBorder="rgba(251,191,36,0.42)"
  >
    <BentoCardHeader
      icon={Quote}
      title="Cited Sources"
      gradient="from-amber-300 to-yellow-600"
      iconGlow="0 6px 22px rgba(251,191,36,0.4)"
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wide mb-2">Flashcard</p>
      <p className="text-[11px] font-semibold text-white/65 leading-relaxed">
        Where does the citric acid cycle take place?
      </p>
      <p className="text-[11px] text-white/40 leading-relaxed mt-1">The mitochondrial matrix.</p>

      <motion.div
        initial={{ opacity: 0, height: 0 }}
        whileInView={{ opacity: 1, height: 'auto' }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.35 }}
        className="overflow-hidden"
      >
        <div className="mt-2.5 pl-2.5" style={{ borderLeft: '2px solid rgba(251,191,36,0.4)' }}>
          <p className="text-[10px] italic leading-relaxed text-white/40">
            “…the reactions of the cycle occur within the mitochondrial matrix, where the required enzymes are
            concentrated.”
          </p>
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold" style={{ color: '#fcd34d' }}>
            Jump to page 42 <ExternalLink className="w-2.5 h-2.5" />
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.85 }}
        className="flex items-start gap-1.5 mt-3 pt-2.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" style={{ color: '#fbbf24' }} />
        <span className="text-[10px] leading-relaxed text-white/35">
          You replaced this file — 12 cards were built from the old version
        </span>
      </motion.div>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Every flashcard, quiz question, and glossary term links back to the exact passage it came from — one click
      to the page or the timestamp. Swap the source file and we flag what was built from the old one.
    </p>
  </BentoCardShell>
);
