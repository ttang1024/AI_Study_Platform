import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Smartphone, Chrome, ScanLine, Fingerprint, BellRing, Scissors, Sparkles } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const MOBILE_FEATURES = [
  { icon: ScanLine, label: 'Camera scan to import' },
  { icon: Fingerprint, label: 'Biometric app lock' },
  { icon: BellRing, label: 'Review reminders' },
];

const CLIPPER_FEATURES = [
  { icon: Scissors, label: 'Clip any page into your library' },
  { icon: Sparkles, label: 'Flashcards from selected text' },
];

export const BentoEverywhereCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(129,140,248,0.06)"
      border="rgba(129,140,248,0.22)"
      hoverShadow="0 0 48px rgba(129,140,248,0.26), 0 0 80px rgba(129,140,248,0.10)"
      hoverBorder="rgba(129,140,248,0.45)"
      hoverScale={1.01}
    >
      <BentoCardHeader
        icon={Smartphone}
        title="Study Everywhere"
        gradient="from-indigo-500 to-violet-600"
        iconGlow="0 6px 22px rgba(129,140,248,0.4)"
      />

      <div className="flex-1 rounded-xl p-3 flex flex-col gap-2.5 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { icon: Smartphone, heading: 'Mobile app · iOS & Android', items: MOBILE_FEATURES, color: '#a5b4fc' },
          { icon: Chrome, heading: 'Chrome web clipper', items: CLIPPER_FEATURES, color: '#c4b5fd' },
        ].map(({ icon: PanelIcon, heading, items, color }, p) => (
          <div key={heading} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <PanelIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
              <span className="text-[11px] font-semibold text-white/55">{heading}</span>
            </div>
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
        The full platform on your phone — plus a Chrome extension that clips articles or turns any selection into flashcards while you browse.
      </p>
    </BentoCardShell>
  );
};
