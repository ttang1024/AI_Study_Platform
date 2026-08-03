import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Share2, Globe, Copy, Check, Link2 } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const SHARE_TYPES = ['Summary', 'Mind Map', 'Quiz', 'Flashcards', 'Glossary', 'Article', 'Video', 'Podcast'];

export const BentoShareCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [copied, setCopied] = useState(false);
  const copyRef = useRef<NodeJS.Timeout | null>(null);

  const copy = () => {
    if (copied) return;
    setCopied(true);
    copyRef.current = setTimeout(() => setCopied(false), 1800);
  };

  useEffect(() => () => { if (copyRef.current) clearTimeout(copyRef.current); }, []);

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(13,148,136,0.06)"
      border="rgba(13,148,136,0.25)"
      hoverShadow="0 0 48px rgba(13,148,136,0.28), 0 0 80px rgba(13,148,136,0.10)"
      hoverBorder="rgba(13,148,136,0.45)"
      hoverScale={1.01}
    >
      <BentoCardHeader
        icon={Share2}
        title="Share Content Publicly"
        gradient="from-teal-500 via-cyan-600 to-sky-700"
        iconGlow="0 6px 22px rgba(13,148,136,0.4)"
      />

      <div className="flex-1 mb-3">
        <div className="rounded-xl p-3 flex flex-col gap-2.5 h-full" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-white/55">Public link</span>
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="ml-auto flex items-center gap-1 text-[10px] font-semibold"
              style={{ color: '#2dd4bf' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Live
            </motion.span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Link2 className="w-3 h-3 text-white/30 flex-shrink-0" />
            <span className="font-mono text-[10px] text-white/45 truncate">toto.ai/share/x7Kp9q</span>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={copy}
              className="ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md flex-shrink-0 transition-colors"
              style={copied
                ? { background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.4)' }
                : { background: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)' }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </motion.button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {SHARE_TYPES.map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 + i * 0.07 }}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(45,212,191,0.08)', color: '#5eead4', border: '1px solid rgba(45,212,191,0.25)' }}
              >
                {t}
              </motion.span>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Share summaries, mind maps, quizzes, flashcards, clips, videos, and podcasts with a single public link — anyone can study from them, no account needed.
      </p>
    </BentoCardShell>
  );
};
