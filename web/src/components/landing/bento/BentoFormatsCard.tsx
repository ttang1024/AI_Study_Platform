import React from 'react';
import { motion } from 'motion/react';
import { FileStack } from 'lucide-react';
import { BentoCardShell, BentoCardHeader } from './BentoCardShell';

const FORMATS = ['PDF', 'DOCX', 'PPTX', 'XLSX', 'EPUB', 'IPYNB', 'CSV', 'SRT', 'PY', 'JSON'];

// Mirrors the real viewer's palette (teal keywords, dim comments) so the
// preview looks like the thing you actually get.
const LINE_TOKENS: { text: string; color?: string }[][] = [
  [{ text: 'def ', color: '#2dd4bf' }, { text: 'total(rows):' }],
  [{ text: '  # one pass', color: 'rgba(255,255,255,0.25)' }],
  [{ text: '  return ', color: '#2dd4bf' }, { text: 'sum(rows)' }],
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

    <div className="flex flex-wrap gap-1.5 mb-3">
      {FORMATS.map((format, i) => (
        <motion.span
          key={format}
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.06 * i }}
          className="font-mono text-[10px] px-2 py-0.5 rounded-md text-white/45"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {format}
        </motion.span>
      ))}
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.7 }}
        className="font-mono text-[10px] px-2 py-0.5 rounded-md"
        style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)', color: '#5eead4' }}
      >
        +220 more
      </motion.span>
    </div>

    <div className="flex-1 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5">
        <span className="text-[10px] text-white/25 font-mono">analysis.py</span>
        <span className="ml-auto text-[9px] text-white/20">3 lines</span>
      </div>

      <div className="py-1.5">
        {LINE_TOKENS.map((tokens, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.75 + i * 0.1 }}
            className="flex font-mono text-[11px] leading-5"
          >
            <span className="w-7 pr-2 text-right text-white/15 select-none">{i + 1}</span>
            <span className="whitespace-pre text-white/55">
              {tokens.map((token, j) => (
                <span key={j} style={token.color ? { color: token.color } : undefined}>{token.text}</span>
              ))}
            </span>
          </motion.div>
        ))}
      </div>
    </div>

    <p className="text-sm text-white/40 leading-relaxed">
      Office, OpenDocument, eBooks, email, scans, subtitles, code. Source files, spreadsheets, notebooks and
      captions render natively — highlighted, tabulated, and timestamped, not dumped as flat text.
    </p>
  </BentoCardShell>
);
