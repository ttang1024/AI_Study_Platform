import React from 'react';
import { motion } from 'motion/react';
import { Tags, FolderOpen, Bookmark } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const TAGS = [
  { label: 'exam-prep', color: '#f87171' },
  { label: 'week 4', color: '#38bdf8' },
  { label: 'needs review', color: '#fbbf24' },
  { label: 'lab', color: '#a78bfa' },
  { label: 'skim later', color: '#34d399' },
];

export const BentoTagsCard: React.FC = () => (
  <BentoCardShell
    background="rgba(255,255,255,0.025)"
    border="rgba(255,255,255,0.08)"
    hoverShadow="0 0 48px rgba(255,255,255,0.10), 0 0 80px rgba(255,255,255,0.05)"
    hoverBorder="rgba(255,255,255,0.22)"
  >
    <BentoCardHeader
      icon={Tags}
      title="Tags & Collections"
      gradient="from-slate-300 to-slate-500"
      iconGlow="0 6px 22px rgba(255,255,255,0.18)"
      isNew
    />

    <div className="flex-1 rounded-xl p-3 mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex flex-wrap gap-1.5">
        {TAGS.map((t, i) => (
          <motion.span
            key={t.label}
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 + i * 0.08 }}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${t.color}1f`, border: `1px solid ${t.color}44`, color: t.color }}
          >
            {t.label}
          </motion.span>
        ))}
      </div>

      <div className="mt-3 pt-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { icon: FolderOpen, label: 'Midterm 2 collection', meta: '14 items' },
          { icon: Bookmark, label: 'Saved view · untouched 30d', meta: '9 items' },
        ].map(({ icon: Icon, label, meta }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.55 + i * 0.12 }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Icon className="w-3 h-3 flex-shrink-0 text-white/40" />
            <span className="text-[11px] font-medium text-white/50 flex-1 truncate">{label}</span>
            <span className="text-[10px] text-white/25">{meta}</span>
          </motion.div>
        ))}
      </div>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Tag anything in your library, group it into collections, and save the filters you keep retyping as one-click
      views.
    </p>
  </BentoCardShell>
);
