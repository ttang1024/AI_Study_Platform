import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Smartphone, Bookmark, ScanLine, Fingerprint, BellRing, Scissors, FileText, CloudOff, BrainCircuit, BookMarked, PenLine, Check } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

/**
 * Mobile, clipper, and offline are one card: they answer the same question — where you can study
 * — and each is too thin to hold a card of its own.
 */
const PANELS = [
  {
    icon: Smartphone,
    heading: 'Mobile app · iOS & Android',
    color: '#a5b4fc',
    items: [
      { icon: ScanLine, label: 'Camera scan to import' },
      { icon: Fingerprint, label: 'Biometric app lock' },
      { icon: BellRing, label: 'Review reminders' },
    ],
  },
  {
    icon: Bookmark,
    heading: 'Web clipper bookmarklet',
    color: '#c4b5fd',
    items: [
      { icon: Scissors, label: 'Clip any page into your library' },
      { icon: FileText, label: 'Saved as clean Markdown' },
    ],
  },
  {
    icon: CloudOff,
    heading: 'Offline · no connection',
    color: '#7dd3fc',
    checked: true,
    items: [
      { icon: BrainCircuit, label: '248 flashcards' },
      { icon: BookMarked, label: '96 glossary terms' },
      { icon: PenLine, label: '31 notes' },
    ],
  },
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

      {/* The card spans two grid columns from `sm` up, and the panels sit side by side there
          rather than stacked — full-width rows across that much card are mostly empty space. */}
      <div className="rounded-xl p-3 grid gap-2.5 sm:grid-cols-3 sm:gap-4 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {PANELS.map(({ icon: PanelIcon, heading, items, color, checked }, p) => (
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
                  {checked && <Check className="w-3 h-3 ml-auto flex-shrink-0" style={{ color: '#34d399' }} />}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        The full platform on your phone, a bookmarklet that clips the article you are reading into your library from any browser, and flashcards, glossary, and notes saved to your device for the subway or a flight — reviews sync back when you reconnect.
      </p>
    </BentoCardShell>
  );
};
