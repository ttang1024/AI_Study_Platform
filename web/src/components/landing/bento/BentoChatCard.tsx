import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Bot, Sparkles } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const CHAT_QUESTION = 'Why does the Krebs cycle need oxygen?';
const CHAT_ANSWER = 'It does not use oxygen directly — but without it the electron transport chain stalls, NADH never recycles, and the cycle halts…';

export const BentoChatCard: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let i = -18; // ~0.5s pause before the AI answer starts streaming
    const iv = setInterval(() => {
      i++;
      if (i > 0) setTyped(i);
      if (i >= CHAT_ANSWER.length) clearInterval(iv);
    }, 28);
    return () => clearInterval(iv);
  }, [inView]);

  const done = typed >= CHAT_ANSWER.length;

  return (
    <BentoCardShell
      rootRef={ref}
      background="rgba(20,184,166,0.06)"
      border="rgba(20,184,166,0.2)"
      hoverShadow="0 0 48px rgba(20,184,166,0.24), 0 0 80px rgba(20,184,166,0.10)"
      hoverBorder="rgba(20,184,166,0.42)"
    >
      <BentoCardHeader
        icon={Bot}
        title="AI Chat"
        gradient="from-teal-500 via-cyan-500 to-sky-600"
        iconGlow="0 6px 22px rgba(13,148,136,0.4)"
      />

      <div className="flex-1 rounded-xl p-3 mb-3 flex flex-col gap-2.5" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex justify-end">
          <span className="max-w-[85%] text-[11px] text-white/75 px-3 py-1.5 rounded-2xl rounded-br-sm"
            style={{ background: 'rgba(13,148,136,0.25)', border: '1px solid rgba(20,184,166,0.3)' }}>
            {CHAT_QUESTION}
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)' }}>
            <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
          </div>
          <span className="max-w-[88%] text-[11px] leading-relaxed text-white/55 px-3 py-1.5 rounded-2xl rounded-bl-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', minHeight: '2rem' }}>
            {CHAT_ANSWER.slice(0, typed)}
            {!done && (
              <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.55 }}
                className="inline-block w-0.5 h-3 align-middle ml-px bg-cyan-300" />
            )}
          </span>
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Ask anything about your documents, videos, audio, podcasts, and web articles. Answers stream back grounded in the source you are studying.
      </p>
    </BentoCardShell>
  );
};
