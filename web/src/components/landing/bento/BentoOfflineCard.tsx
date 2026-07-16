import React from 'react';
import { motion } from 'motion/react';
import { CloudOff, BrainCircuit, BookMarked, PenLine, Check } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const SAVED = [
  { icon: BrainCircuit, label: 'Flashcards', count: 248 },
  { icon: BookMarked, label: 'Glossary terms', count: 96 },
  { icon: PenLine, label: 'Notes', count: 31 },
];

export const BentoOfflineCard: React.FC = () => (
  <BentoCardShell
    background="rgba(56,189,248,0.06)"
    border="rgba(56,189,248,0.2)"
    hoverShadow="0 0 48px rgba(56,189,248,0.22), 0 0 80px rgba(56,189,248,0.10)"
    hoverBorder="rgba(56,189,248,0.42)"
  >
    <BentoCardHeader
      icon={CloudOff}
      title="Offline Study"
      gradient="from-sky-500 to-blue-600"
      iconGlow="0 6px 22px rgba(56,189,248,0.4)"
      isNew
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-white/75">Saved for offline</span>
        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#7dd3fc' }} /> No connection
        </span>
      </div>
      <div className="space-y-1.5">
        {SAVED.map(({ icon: Icon, label, count }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.12 }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Icon className="w-3 h-3 flex-shrink-0" style={{ color: '#7dd3fc' }} />
            <span className="text-[11px] font-semibold text-white/55">{count} {label.toLowerCase()}</span>
            <Check className="w-3 h-3 ml-auto" style={{ color: '#34d399' }} />
          </motion.div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/25">Reviews sync back automatically when you reconnect</p>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Save flashcards, glossary, and notes to your device and keep studying on the subway or a flight — progress syncs when you're back online.
    </p>
  </BentoCardShell>
);
