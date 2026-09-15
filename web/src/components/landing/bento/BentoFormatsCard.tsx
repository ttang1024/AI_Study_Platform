import React from 'react';
import { motion } from 'motion/react';
import { FileStack, ClipboardPaste } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';
import { CONTENT_TYPE_ICONS } from '../../../constants/contentTypeIcons';

// The five inputs the add-content page offers, in its order and with its icons and colours — the
// card is a preview of that screen, so it reads from the same map rather than restating it.
// Paste Text is the exception: it has no content type of its own, and that screen draws its tab in
// the app's primary green, so the colour is spelled out here.
const SOURCES = [
  {
    ...CONTENT_TYPE_ICONS.document,
    label: 'Document',
    detail: '234 types — PDF, Office, eBooks, notebooks, code',
  },
  {
    ...CONTENT_TYPE_ICONS.video,
    label: 'Video',
    detail: 'YouTube, Bilibili and 9 more sites, or your own upload',
  },
  {
    ...CONTENT_TYPE_ICONS.article,
    label: 'Web Article',
    detail: 'Any page, clipped to clean readable Markdown',
  },
  {
    ...CONTENT_TYPE_ICONS.audio,
    label: 'Audio',
    detail: 'Lectures, podcast episodes, an RSS feed or an MP3',
  },
  {
    icon: ClipboardPaste,
    color: '#059669',
    label: 'Paste Text',
    detail: 'Straight from the clipboard — notes, an email, anything',
  },
];

export const BentoFormatsCard: React.FC = () => (
  <BentoCardShell
    background="rgba(45,212,191,0.06)"
    border="rgba(45,212,191,0.2)"
    hoverShadow="0 0 48px rgba(45,212,191,0.22), 0 0 80px rgba(45,212,191,0.10)"
    hoverBorder="rgba(45,212,191,0.42)"
  >
    <BentoCardHeader
      icon={FileStack}
      title="Reads 230+ Formats"
      gradient="from-teal-400 to-cyan-600"
      iconGlow="0 6px 22px rgba(45,212,191,0.4)"
      isNew
    />

    {/* The card spans two grid columns from `sm` up, so the five sources straighten out into a
        single row once there is room for it, and pack two-up below that. */}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-3">
      {SOURCES.map(({ icon: Icon, color, label, detail }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 * i }}
          className="flex flex-col gap-1.5 p-3 rounded-xl"
          // Each tile is tinted with its own source colour, the same one the app uses for that
          // content type everywhere else, so the five stay distinguishable at a glance.
          style={{ background: `${color}14`, border: `1px solid ${color}33` }}
        >
          {/* Icon above the label rather than beside it: five-across leaves a tile barely wider
              than "Web Article", and sharing that row with the icon wrapped the label onto a
              second line, pushing its detail text out of line with the other four. */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}26` }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <span className="text-[13px] font-bold text-white/85 leading-tight">{label}</span>
          <p className="text-[11px] text-white/40 leading-snug">{detail}</p>
        </motion.div>
      ))}
    </div>

    {/* mt-auto, not flex-1 on the tiles: the card stretches to its row's height, and stretching the
        tiles with it leaves a block of dead space under the shorter ones. */}
    <p className="mt-auto text-sm text-white/40 leading-relaxed">
      Drop in whatever you already have. Source files, spreadsheets, notebooks and captions render
      natively — highlighted, tabulated and timestamped, not dumped as flat text.
    </p>
  </BentoCardShell>
);
