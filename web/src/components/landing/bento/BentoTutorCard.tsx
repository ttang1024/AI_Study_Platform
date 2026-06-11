import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, CheckCircle2 } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const TUTOR_BARS = [4, 7, 5, 9, 6, 10, 7, 5, 8, 6, 9, 4, 7, 10, 6, 8, 5, 7];

export const BentoTutorCard: React.FC = () => {
  const [listening, setListening] = useState(true);

  return (
    <BentoCardShell
      background="rgba(244,63,94,0.06)"
      border="rgba(244,63,94,0.2)"
      hoverShadow="0 0 48px rgba(244,63,94,0.24), 0 0 80px rgba(244,63,94,0.10)"
      hoverBorder="rgba(244,63,94,0.42)"
    >
      <BentoCardHeader
        icon={Mic}
        title={<>Voice Tutor &amp; Teach-Back</>}
        gradient="from-rose-400 to-pink-600"
        iconGlow="0 6px 22px rgba(244,63,94,0.4)"
      />

      <div className="flex-1 rounded-xl p-3 mb-3 flex flex-col gap-2.5" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setListening(l => !l)}
            className="relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #fb7185, #ec4899)', boxShadow: '0 4px 16px rgba(244,63,94,0.5)' }}
          >
            {listening && (
              <motion.span
                animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="absolute inset-0 rounded-full"
                style={{ border: '1.5px solid #fb7185' }}
              />
            )}
            <Mic className="w-3.5 h-3.5 text-white" />
          </motion.button>
          <div className="flex items-end gap-px h-7 flex-1">
            {TUTOR_BARS.map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-sm"
                style={{ height: `${(h / 10) * 100}%`, background: 'linear-gradient(to top, #e11d48, #fb7185)' }}
                animate={listening ? { scaleY: [1, 1.5, 0.7, 1.3, 1] } : { scaleY: 0.4 }}
                transition={listening
                  ? { repeat: Infinity, duration: 0.55 + i * 0.05, ease: 'easeInOut', delay: i * 0.03 }
                  : { duration: 0.3 }}
                initial={false}
              />
            ))}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-white/50 italic">
          “Mitosis is how one cell splits into two identical copies…”
        </p>

        <div className="flex items-center gap-2 mt-auto px-2.5 py-1.5 rounded-lg"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#34d399' }} />
          <span className="text-[11px] font-semibold" style={{ color: '#6ee7b7' }}>Teach-back score 92%</span>
          <span className="text-[10px] text-white/30 truncate">— clear causal chain!</span>
        </div>
      </div>

      <p className="text-sm text-white/40 leading-relaxed">
        Talk through concepts with a voice AI tutor, or explain a topic in your own words and get graded teach-back feedback.
      </p>
    </BentoCardShell>
  );
};
