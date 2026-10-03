import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { FileStack } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';
import { CONTENT_TYPE_ICONS } from '../../../constants/contentTypeIcons';
import { DOCUMENT_ACCEPTED_EXTENSIONS } from '../../../constants/documentUpload';

// The content types the add-content page offers, in its order and with its icons — the card is a
// preview of that screen, so it reads from the same map rather than restating it. Each row also
// carries that type's colour, one step lighter than `CONTENT_TYPE_ICONS`: those hexes are picked
// for the app's white surfaces and go muddy on this near-black panel.
const SOURCES = [
  {
    icon: CONTENT_TYPE_ICONS.document.icon,
    color: '#60a5fa', // blue-400 — app blue-600
    label: 'Documents',
    // Counted off the upload allowlist itself rather than written out, so the claim can't drift
    // the way a hand-typed number already did when the list grew.
    detail: `${DOCUMENT_ACCEPTED_EXTENSIONS.length} types — PDF, Office, eBooks, notebooks, code`,
  },
  {
    icon: CONTENT_TYPE_ICONS.video.icon,
    color: '#f87171', // red-400 — app red-500
    label: 'Video',
    detail: 'YouTube and 10 more sites, or your own upload',
  },
  {
    icon: CONTENT_TYPE_ICONS.article.icon,
    color: '#2dd4bf', // teal-400 — app teal-500
    label: 'Web articles',
    detail: 'Any page, clipped to clean readable Markdown',
  },
  {
    icon: CONTENT_TYPE_ICONS.audio.icon,
    color: '#fbbf24', // amber-400 — app amber-500
    label: 'Audio',
    detail: 'Lectures, podcast episodes, an RSS feed or an MP3',
  },
];

export const BentoFormatsCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(45,212,191,0.06)"
      border="rgba(45,212,191,0.2)"
      hoverShadow="0 0 48px rgba(45,212,191,0.22), 0 0 80px rgba(45,212,191,0.10)"
      hoverBorder="rgba(45,212,191,0.42)"
    >
      <BentoCardHeader
        icon={FileStack}
        title="Reads 240+ Formats"
        gradient="from-teal-400 to-cyan-600"
        iconGlow="0 6px 22px rgba(45,212,191,0.4)"
      />

      {/* One inset panel of rules-separated rows rather than five tinted tiles. The card is a
          single column of the grid, so each detail sits under its label instead of in a second
          column — beside a label it would only wrap after two or three words. */}
      <div
        className="rounded-xl px-3 py-1 mb-3"
        style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {SOURCES.map(({ icon: Icon, label, detail, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -6 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.15 + i * 0.08 }}
            /* Two-column grid rather than a flex row with a nudged icon: the icon shares the
               label's grid row, so `items-center` centres it on the label whatever line height the
               label inherits, and the detail starts on the label's left edge in the second row. */
            className="grid grid-cols-[0.875rem_1fr] items-center gap-x-2.5 py-2"
            style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.06)' } : undefined}
          >
            <Icon className="w-3.5 h-3.5" style={{ color }} />
            <span className="text-[13px] font-semibold text-white/80 leading-tight">{label}</span>
            <p className="col-start-2 text-[11px] text-white/40 leading-snug">{detail}</p>
          </motion.div>
        ))}
      </div>

      <p className="mt-auto text-sm text-white/40 leading-relaxed">
        Drop in whatever you already have.
      </p>
    </BentoCardShell>
  );
};
