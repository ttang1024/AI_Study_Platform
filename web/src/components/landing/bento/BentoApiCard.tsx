import React from 'react';
import { motion } from 'motion/react';
import { Webhook, KeyRound } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const SCOPES = ['library:read', 'flashcards:write', 'analytics:read'];

const DELIVERIES = [
  { event: 'flashcards.generated', status: '200' },
  { event: 'certificate.issued', status: '200' },
];

export const BentoApiCard: React.FC = () => (
  <BentoCardShell
    background="rgba(148,163,184,0.07)"
    border="rgba(148,163,184,0.2)"
    hoverShadow="0 0 48px rgba(148,163,184,0.22), 0 0 80px rgba(148,163,184,0.10)"
    hoverBorder="rgba(148,163,184,0.42)"
  >
    <BentoCardHeader
      icon={Webhook}
      title="API & Webhooks"
      gradient="from-slate-400 to-slate-600"
      iconGlow="0 6px 22px rgba(148,163,184,0.4)"
      isNew
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2">
        <KeyRound className="w-3 h-3 flex-shrink-0" style={{ color: '#cbd5e1' }} />
        <span className="text-[11px] font-mono text-white/50">sp_live_9c4a</span>
        <span className="text-[11px] font-mono text-white/20">••••••••••</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {SCOPES.map((s, i) => (
          <motion.span
            key={s}
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 + i * 0.1 }}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)', color: '#cbd5e1' }}
          >
            {s}
          </motion.span>
        ))}
      </div>

      <div className="mt-3 pt-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {DELIVERIES.map((d, i) => (
          <motion.div
            key={d.event}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + i * 0.14 }}
            className="flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#4ade80' }} />
            <span className="text-[10px] font-mono text-white/45 flex-1 truncate">{d.event}</span>
            <span className="text-[10px] font-mono" style={{ color: '#4ade80' }}>{d.status}</span>
          </motion.div>
        ))}
      </div>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Scoped API keys and signed webhooks, so your own scripts and tools can read your library, push flashcards, or
      react the moment a deck is generated.
    </p>
  </BentoCardShell>
);
