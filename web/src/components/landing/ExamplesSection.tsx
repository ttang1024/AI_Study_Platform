import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight, Brain, FileText, HelpCircle, Layers, Network, ScrollText, Youtube,
} from 'lucide-react';
import { FadeIn } from './LandingAnimations';
import { Badge } from './Badge';

/**
 * Real share links the author generated on this platform and published with the share button —
 * the same `/share/{token}` pages any user gets. They are live production URLs, not fixtures: if
 * a share is ever revoked or expires the card here 404s, so re-check these before pruning shares.
 * Everything shown on a card (source, snippet, artifact list) is copied from that share's own
 * payload, so keep the two in step rather than embellishing.
 */
const EXAMPLES: {
  href: string;
  source: string;
  sourceIcon: React.ElementType;
  accent: string;
  title: string;
  snippet: string;
  artifacts: { icon: React.ElementType; label: string }[];
}[] = [
  {
    href: 'https://toto-study.com/share/Xlv92yWNx_6Q',
    source: 'From a PDF',
    sourceIcon: FileText,
    accent: '#22d3ee',
    title: 'Transformers',
    snippet:
      'Transformer architectures overcome the structural limits of fully-connected networks: dot-product self-attention routes each token by query–key similarity, and positional encodings put word order back into a permutation-equivariant mechanism.',
    artifacts: [
      { icon: ScrollText, label: 'Summary' },
      { icon: Network, label: 'Mind map' },
      { icon: Layers, label: '14 flashcards' },
      { icon: HelpCircle, label: '4 quiz questions' },
    ],
  },
  {
    href: 'https://toto-study.com/share/RmnAj0xf25B8',
    source: 'From a YouTube video',
    sourceIcon: Youtube,
    accent: '#34d399',
    title: 'Transformers, the tech behind LLMs | Deep Learning Chapter 5',
    snippet:
      'How a GPT turns text into high-dimensional vectors and refines them layer by layer — embeddings, attention blocks and MLPs — until the final vector becomes a probability distribution over the next token.',
    artifacts: [
      { icon: ScrollText, label: 'Summary' },
      { icon: Network, label: 'Mind map' },
      { icon: Layers, label: '6 flashcards' },
      { icon: HelpCircle, label: '4 quiz questions' },
    ],
  },
];

export const ExamplesSection: React.FC = () => (
  <section className="relative py-24 px-6">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24"
      style={{ background: 'linear-gradient(to bottom, transparent, rgba(13,148,136,0.4), transparent)' }} />

    <div className="max-w-5xl mx-auto">
      <FadeIn className="text-center mb-14">
        <Badge icon={Brain} label="See real output" />
        <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <span style={{ background: 'linear-gradient(135deg, #e0f7ff, #a5f3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Made with</span>{' '}
          <span style={{ background: 'linear-gradient(135deg, #14b8a6, #0891b2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Toto Study</span>
        </h2>
        <p className="mt-4 text-white/40 max-w-xl mx-auto">
          Two study sets I generated here from my own material and shared as-is. No account needed — open either one.
        </p>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {EXAMPLES.map((ex, i) => {
          const SourceIcon = ex.sourceIcon;
          return (
            <FadeIn key={ex.href} delay={0.1 * i}>
              <motion.a
                href={ex.href}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -5, scale: 1.015 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                className="group flex flex-col h-full p-6 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = `0 12px 40px ${ex.accent}22`;
                  e.currentTarget.style.borderColor = `${ex.accent}55`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${ex.accent}18`, border: `1px solid ${ex.accent}40`, color: ex.accent }}>
                    <SourceIcon className="w-3.5 h-3.5" />
                    {ex.source}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-white/25 transition-all group-hover:text-white/70 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>

                <h3 className="text-lg font-bold text-white leading-snug mb-3">{ex.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed line-clamp-4 mb-5">{ex.snippet}</p>

                <div className="flex flex-wrap gap-2 mt-auto pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {ex.artifacts.map(({ icon: Icon, label }) => (
                    <span key={label}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg text-white/55"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <Icon className="w-3 h-3" />
                      {label}
                    </span>
                  ))}
                </div>

                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ex.accent }}>
                  Open the shared page
                </span>
              </motion.a>
            </FadeIn>
          );
        })}
      </div>
    </div>
  </section>
);
