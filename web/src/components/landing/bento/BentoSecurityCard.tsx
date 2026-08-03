import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { ShieldCheck, Fingerprint, KeyRound, Laptop, Download, ScrollText, Trash2 } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const ACCOUNT_ITEMS = [
  { icon: Fingerprint, label: 'Two-factor via authenticator app' },
  { icon: KeyRound, label: 'One-time recovery codes' },
  { icon: Laptop, label: 'Sign out every other device' },
];

const DATA_ITEMS = [
  { icon: Download, label: 'Export everything we hold on you' },
  { icon: ScrollText, label: 'Your own security log' },
  { icon: Trash2, label: 'Delete the account for good' },
];

export const BentoSecurityCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(74,222,128,0.06)"
      border="rgba(74,222,128,0.22)"
      hoverShadow="0 0 48px rgba(74,222,128,0.26), 0 0 80px rgba(74,222,128,0.10)"
      hoverBorder="rgba(74,222,128,0.45)"
      hoverScale={1.01}
    >
      <BentoCardHeader
        icon={ShieldCheck}
        title="Your Account, Locked Down"
        gradient="from-green-400 to-emerald-600"
        iconGlow="0 6px 22px rgba(74,222,128,0.4)"
        isNew
      />

      <div className="flex-1 rounded-xl p-3 flex flex-col gap-2.5 mb-3"
        style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { heading: 'Account protection', items: ACCOUNT_ITEMS, color: '#86efac' },
          { heading: 'Your data, your call', items: DATA_ITEMS, color: '#6ee7b7' },
        ].map(({ heading, items, color }, p) => (
          <div key={heading} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-white/55">{heading}</span>
            <div className="space-y-1.5">
              {items.map(({ icon: Icon, label }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -6 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.2 + p * 0.15 + i * 0.1 }}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
                  <span className="text-[11px] font-medium text-white/50">{label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Turn on two-factor auth, cut off any device that shouldn't be signed in, and read the log of what happened
        on your account — then export the whole archive or delete it all, no support ticket required.
      </p>
    </BentoCardShell>
  );
};
