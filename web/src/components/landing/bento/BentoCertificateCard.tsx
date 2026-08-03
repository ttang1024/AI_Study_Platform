import React from 'react';
import { motion } from 'motion/react';
import { Award, BadgeCheck } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

export const BentoCertificateCard: React.FC = () => (
  <BentoCardShell
    background="rgba(250,204,21,0.06)"
    border="rgba(250,204,21,0.2)"
    hoverShadow="0 0 48px rgba(250,204,21,0.22), 0 0 80px rgba(250,204,21,0.10)"
    hoverBorder="rgba(250,204,21,0.42)"
  >
    <BentoCardHeader
      icon={Award}
      title="Certificates"
      gradient="from-yellow-300 to-amber-500"
      iconGlow="0 6px 22px rgba(250,204,21,0.4)"
      isNew
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className="rounded-lg p-3 text-center"
        style={{ border: '1px solid rgba(250,204,21,0.28)', background: 'rgba(250,204,21,0.05)' }}
      >
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">Certificate of Completion</p>
        <p className="mt-1.5 text-[13px] font-bold" style={{ color: '#fde68a' }}>Organic Chemistry I</p>
        <p className="text-[10px] text-white/35 mt-0.5">Mastery 92% · 148 cards reviewed</p>
        <div className="mt-2 pt-2 flex items-center justify-center gap-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <BadgeCheck className="w-3 h-3" style={{ color: '#facc15' }} />
          <span className="text-[9px] font-mono text-white/35">/verify/8f2c-91ad</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 }}
        className="mt-2.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-[10px] text-white/45">Linear Algebra</span>
        <span className="text-[10px] font-semibold text-white/30">74% · 6% to go</span>
      </motion.div>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Hit the mastery bar on a course and earn a certificate with a public verification link — anyone you send it to
      can check it without an account.
    </p>
  </BentoCardShell>
);
