import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Search, Sparkles, FileText, Video, PenLine } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const SEARCH_QUERY = 'krebs cycle';
const SEARCH_RESULTS = [
  { icon: FileText, type: 'PDF', title: 'Cell Biology — Chapter 4', color: '#22d3ee' },
  { icon: Video, type: 'Video', title: 'Energy Metabolism Lecture', color: '#a78bfa' },
  { icon: PenLine, type: 'Note', title: 'ATP synthesis summary', color: '#fbbf24' },
];

export const BentoSearchCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let i = -10; // brief pause before typing starts
    const iv = setInterval(() => {
      i++;
      if (i > 0) setTyped(i);
      if (i >= SEARCH_QUERY.length) clearInterval(iv);
    }, 90);
    return () => clearInterval(iv);
  }, [inView]);

  const doneTyping = typed >= SEARCH_QUERY.length;

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(34,211,238,0.06)"
      border="rgba(34,211,238,0.2)"
      hoverShadow="0 0 48px rgba(34,211,238,0.24), 0 0 80px rgba(34,211,238,0.10)"
      hoverBorder="rgba(34,211,238,0.42)"
    >
      <BentoCardHeader
        icon={Search}
        title="Global Search"
        gradient="from-cyan-400 to-blue-600"
        iconGlow="0 6px 22px rgba(34,211,238,0.4)"
      />

      <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
          <Search className="w-3 h-3 text-cyan-400/60 flex-shrink-0" />
          <span className="text-[11px] text-white/60 font-medium">
            {SEARCH_QUERY.slice(0, typed)}
            {!doneTyping && (
              <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.55 }}
                className="inline-block w-0.5 h-3 align-middle ml-px bg-cyan-300" />
            )}
            {typed === 0 && <span className="text-white/20">Search your library…</span>}
          </span>
        </div>
        <div className="divide-y divide-white/5">
          {SEARCH_RESULTS.map((r, i) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={doneTyping ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.15 }}
                className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-white/5"
              >
                <Icon className="w-3 h-3 flex-shrink-0" style={{ color: r.color }} />
                <span className="text-[11px] text-white/55 truncate">{r.title}</span>
                <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${r.color}18`, color: r.color }}>
                  {r.type}
                </span>
              </motion.div>
            );
          })}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={doneTyping ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="flex items-start gap-1.5 px-3 py-2 border-t border-white/5"
        >
          <Sparkles className="w-3 h-3 text-cyan-300 flex-shrink-0 mt-0.5" />
          <span className="text-[10px] leading-relaxed text-cyan-200/60">
            AI: The Krebs cycle oxidizes acetyl-CoA to harvest electrons for ATP production. <span className="text-white/25">· 3 sources</span>
          </span>
        </motion.div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Instant full-text search across all documents, videos, notes, and flashcards — plus ask-your-library AI answers with cited sources.
      </p>
    </BentoCardShell>
  );
};
