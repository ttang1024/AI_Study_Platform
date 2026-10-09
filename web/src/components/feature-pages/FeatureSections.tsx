import React from 'react';
import { ArrowUpRight, ChevronDown, Play } from 'lucide-react';
import type { FeaturePageExample, FeaturePageFaq, FeaturePageSection } from '../../seo/featurePages';
import { cardStyle, type FeatureTheme } from './theme';

type ThemeProps = { theme: FeatureTheme };

const Heading: React.FC<ThemeProps & { id: string; children: React.ReactNode }> = ({ theme, id, children }) => (
  <h2 id={id} className="text-2xl sm:text-3xl font-bold mb-8 tracking-tight" style={{ fontFamily: theme.headingFont }}>{children}</h2>
);

// ── Steps ────────────────────────────────────────────────────────────────────

const DeckSteps: React.FC<ThemeProps & { steps: string[] }> = ({ theme, steps }) => (
  <ol className="grid gap-6 sm:grid-cols-3 sm:gap-4">
    {steps.map((step, i) => (
      <li key={i} className="rounded-2xl p-5 transition-transform hover:-translate-y-1 hover:rotate-0"
        style={{ ...cardStyle(theme), color: theme.text, transform: `rotate(${(i - 1) * 2}deg)`, boxShadow: '0 14px 30px -10px rgba(15,23,42,0.18)' }}>
        <span className="block text-4xl font-bold mb-2 text-cyan-600" style={{ fontFamily: theme.headingFont }}>{i + 1}</span>
        <p className="leading-relaxed text-[15px]" style={{ color: theme.muted }}>{step}</p>
      </li>
    ))}
  </ol>
);

const ProgressSteps: React.FC<ThemeProps & { steps: string[] }> = ({ theme, steps }) => (
  <div>
    <div className="flex gap-1.5 mb-6" aria-hidden>
      {steps.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: theme.ctaBackground, opacity: 0.4 + i * 0.3 }} />)}
    </div>
    <ol className="grid gap-4 sm:grid-cols-3">
      {steps.map((step, i) => (
        <li key={i} className="rounded-2xl p-5" style={cardStyle(theme)}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.accentText }}>Step {i + 1} of {steps.length}</span>
          <p className="mt-2 leading-relaxed" style={{ color: theme.muted }}>{step}</p>
        </li>
      ))}
    </ol>
  </div>
);

const NumberedSteps: React.FC<ThemeProps & { steps: string[] }> = ({ theme, steps }) => (
  <ol className="space-y-6">
    {steps.map((step, i) => (
      <li key={i} className="grid grid-cols-[3rem_1fr] gap-4 items-baseline pb-6" style={{ borderBottom: `1px solid ${theme.line}` }}>
        <span className="text-4xl italic" style={{ fontFamily: theme.headingFont, color: theme.accent }}>{i + 1}.</span>
        <p className="text-lg leading-relaxed" style={{ color: theme.muted }}>{step}</p>
      </li>
    ))}
  </ol>
);

const TimelineSteps: React.FC<ThemeProps & { steps: string[] }> = ({ theme, steps }) => (
  <ol className="relative grid gap-8 sm:grid-cols-3 sm:gap-6">
    <span className="absolute left-[7px] top-2 bottom-2 w-0.5 sm:left-0 sm:right-0 sm:top-[7px] sm:bottom-auto sm:w-auto sm:h-0.5" aria-hidden
      style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.line})` }} />
    {steps.map((step, i) => (
      <li key={i} className="relative pl-8 sm:pl-0 sm:pt-8">
        <span className="absolute left-0 top-1 sm:top-0 w-4 h-4 rounded-full" style={{ background: theme.accent, boxShadow: `0 0 0 4px ${theme.accentSoft}` }} />
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded" style={{ background: theme.accentSoft, color: theme.accentText }}>
          {theme.stepLabels?.[i] ?? `Step ${i + 1}`}
        </span>
        <p className="mt-3 leading-relaxed" style={{ color: theme.muted }}>{step}</p>
      </li>
    ))}
  </ol>
);

const BranchSteps: React.FC<ThemeProps & { steps: string[] }> = ({ theme, steps }) => (
  <ol className="relative max-w-2xl mx-auto">
    <span className="absolute left-5 top-5 bottom-5 w-0.5" style={{ background: theme.line }} aria-hidden />
    {steps.map((step, i) => (
      <li key={i} className="relative flex gap-5 items-start pb-8 last:pb-0">
        <span className="relative z-10 w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: theme.ctaBackground, color: '#fff', fontFamily: theme.headingFont, boxShadow: theme.ctaShadow }}>{i + 1}</span>
        <p className="pt-2 leading-relaxed rounded-2xl" style={{ color: theme.muted }}>{step}</p>
      </li>
    ))}
  </ol>
);

const STEPS = { deck: DeckSteps, progress: ProgressSteps, numbered: NumberedSteps, timeline: TimelineSteps, branch: BranchSteps };

export const FeatureSteps: React.FC<ThemeProps & { steps: string[] }> = ({ theme, steps }) => {
  const Layout = STEPS[theme.steps];
  return (
    <section className="py-14" aria-labelledby="how-it-works">
      <Heading theme={theme} id="how-it-works">{theme.stepsHeading}</Heading>
      <Layout theme={theme} steps={steps} />
    </section>
  );
};

// ── Sections ─────────────────────────────────────────────────────────────────

type SectionsProps = ThemeProps & { sections: FeaturePageSection[] };

const IndexCardSections: React.FC<SectionsProps> = ({ theme, sections }) => (
  <div className="grid gap-6 sm:grid-cols-2">
    {sections.map((s, i) => (
      <article key={s.heading} className="rounded-xl p-6 pt-5"
        style={{ background: '#ffffff', color: theme.text, border: `1px solid ${theme.line}`, transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)`, boxShadow: '0 12px 28px -10px rgba(15,23,42,0.16)',
          backgroundImage: 'linear-gradient(180deg, transparent 44px, rgba(244,114,182,0.45) 44px 45px, transparent 45px), repeating-linear-gradient(180deg, transparent 0 27px, rgba(14,165,233,0.13) 27px 28px)' }}>
        <h3 className="text-lg font-bold mb-4 leading-tight" style={{ fontFamily: theme.headingFont }}>{s.heading}</h3>
        <p className="leading-7" style={{ color: theme.muted }}>{s.body}</p>
      </article>
    ))}
  </div>
);

const OptionSections: React.FC<SectionsProps> = ({ theme, sections }) => (
  <div className="grid gap-4">
    {sections.map((s, i) => (
      <article key={s.heading} className="flex gap-4 rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
        style={cardStyle(theme)}>
        <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-extrabold"
          style={{ background: theme.ctaBackground, color: '#fff' }}>{String.fromCharCode(65 + i)}</span>
        <div>
          <h3 className="text-lg font-bold mb-1">{s.heading}</h3>
          <p className="leading-relaxed" style={{ color: theme.muted }}>{s.body}</p>
        </div>
      </article>
    ))}
  </div>
);

const DocumentSections: React.FC<SectionsProps> = ({ theme, sections }) => (
  <div className="rounded-2xl px-6 py-8 sm:px-12 sm:py-10" style={{ ...cardStyle(theme), borderLeft: `3px solid ${theme.accent}` }}>
    {sections.map((s) => (
      <article key={s.heading} className="mb-8 last:mb-0">
        <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: theme.headingFont }}>
          <span style={{ backgroundImage: `linear-gradient(transparent 55%, ${theme.accentSoft} 55%)` }}>{s.heading}</span>
        </h3>
        <p className="leading-8" style={{ color: theme.muted }}>{s.body}</p>
      </article>
    ))}
  </div>
);

/** Lazy, so the players below the hero only load as they scroll into view. */
const YouTubeEmbed: React.FC<{ videoId: string; title: string; start?: number }> = ({ videoId, title, start }) => (
  <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
    <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0${start ? `&start=${start}` : ''}`} title={title} loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
      className="absolute inset-0 w-full h-full" />
  </div>
);

const isTimestamp = (label: string) => /^\d+:\d\d$/.test(label);
const toSeconds = (label: string) => label.split(':').reduce((total, part) => total * 60 + Number(part), 0);

const ChapterSections: React.FC<SectionsProps> = ({ theme, sections }) => (
  <div className="grid gap-6">
    {sections.map((s, i) => (
      <article key={s.heading} className="grid sm:grid-cols-[18rem_1fr] gap-5 items-start">
        {s.example?.videoId ? (
          <YouTubeEmbed videoId={s.example.videoId} title={s.heading}
            start={isTimestamp(s.example.label) ? toSeconds(s.example.label) : undefined} />
        ) : (
          <div className="relative aspect-video rounded-xl overflow-hidden"
            style={{ background: `linear-gradient(135deg, hsl(${190 + i * 12} 80% 94%), hsl(${190 + i * 12} 60% 84%))`, border: `1px solid ${theme.line}` }}>
            <Play className="absolute inset-0 m-auto w-8 h-8" style={{ color: theme.accentText, fill: theme.accentText }} />
          </div>
        )}
        <div>
          <h3 className="text-lg font-bold mb-1">{s.heading}</h3>
          <p className="leading-relaxed" style={{ color: theme.muted }}>{s.body}</p>
          {s.example && (
            <blockquote className="mt-3 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed"
              style={{ background: theme.accentSoft, borderLeft: `2px solid ${theme.accent}` }}>
              <span className="block text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: theme.accentText }}>
                {isTimestamp(s.example.label) ? `Chapter at ${s.example.label}` : s.example.label}
              </span>
              {s.example.text}
            </blockquote>
          )}
        </div>
      </article>
    ))}
  </div>
);

const TileSections: React.FC<SectionsProps> = ({ theme, sections }) => (
  <div className="grid gap-4 sm:grid-cols-3">
    {sections.map((s, i) => (
      <article key={s.heading} className="rounded-2xl p-5" style={cardStyle(theme)}>
        <div className="flex items-end gap-1 h-10 mb-4" aria-hidden>
          {[0.35, 0.55, 0.45, 0.75, 0.6, 0.9].map((h, j) => (
            <span key={j} className="flex-1 rounded-sm" style={{ height: `${h * (0.7 + i * 0.15) * 100}%`, background: j === 5 ? theme.accent : theme.accentSoft }} />
          ))}
        </div>
        <h3 className="font-bold mb-2" style={{ fontFamily: theme.headingFont }}>{s.heading}</h3>
        <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>{s.body}</p>
      </article>
    ))}
  </div>
);

const NodeSections: React.FC<SectionsProps> = ({ theme, sections }) => (
  <div className="relative grid gap-6 sm:grid-cols-2">
    {sections.map((s) => (
      <article key={s.heading} className="relative rounded-3xl p-6" style={cardStyle(theme)}>
        <span className="absolute -top-2 left-8 w-4 h-4 rounded-full" style={{ background: theme.accent, boxShadow: `0 0 0 5px ${theme.accentSoft}` }} />
        <h3 className="text-lg font-bold mb-2" style={{ fontFamily: theme.headingFont, color: theme.accentText }}>{s.heading}</h3>
        <p className="leading-relaxed" style={{ color: theme.muted }}>{s.body}</p>
      </article>
    ))}
  </div>
);

const SECTIONS = {
  'index-cards': IndexCardSections,
  options: OptionSections,
  document: DocumentSections,
  chapters: ChapterSections,
  tiles: TileSections,
  nodes: NodeSections,
};

export const FeatureBenefits: React.FC<SectionsProps> = ({ theme, sections }) => {
  const Layout = SECTIONS[theme.sections];
  return (
    <section className="py-14" aria-labelledby="why">
      <Heading theme={theme} id="why">Why students use it</Heading>
      <Layout theme={theme} sections={sections} />
    </section>
  );
};

// ── Examples ─────────────────────────────────────────────────────────────────

export const FeatureExamples: React.FC<ThemeProps & { examples: FeaturePageExample[] }> = ({ theme, examples }) => (
  <section className="py-14" aria-labelledby="examples">
    <Heading theme={theme} id="examples">Real summaries made with Toto Study</Heading>
    <div className="grid gap-4 sm:grid-cols-2">
      {examples.map((ex) => (
        <article key={ex.sharePath} className="flex flex-col rounded-2xl p-5" style={cardStyle(theme)}>
          <div className="mb-4"><YouTubeEmbed videoId={ex.videoId} title={ex.title} /></div>
          <a href={ex.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold hover:underline" style={{ color: theme.accentText }}>
            {ex.source}
          </a>
          <h3 className="mt-2 text-lg font-bold leading-snug">{ex.title}</h3>
          <blockquote className="mt-3 pl-3 text-sm leading-relaxed" style={{ color: theme.muted, borderLeft: `2px solid ${theme.accent}` }}>
            {ex.excerpt}
          </blockquote>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {ex.includes.map((item) => (
              <li key={item} className="text-xs px-2.5 py-1 rounded-full" style={{ background: theme.accentSoft, color: theme.accentText }}>{item}</li>
            ))}
          </ul>
          <a href={ex.sharePath} className="mt-auto pt-5 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: theme.accentText }}>
            Read the full summary <ArrowUpRight className="w-4 h-4" />
          </a>
        </article>
      ))}
    </div>
  </section>
);

// ── FAQ ──────────────────────────────────────────────────────────────────────

export const FeatureFaq: React.FC<ThemeProps & { faqs: FeaturePageFaq[] }> = ({ theme, faqs }) => (
  <section className="py-14" aria-labelledby="faq">
    <Heading theme={theme} id="faq">Frequently asked questions</Heading>
    <div className="divide-y rounded-2xl overflow-hidden" style={cardStyle(theme)}>
      {faqs.map((faq, i) => (
        <details key={faq.question} className="group px-5" open={i === 0} style={{ borderColor: theme.line }}>
          <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">
            {faq.question}
            <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" style={{ color: theme.accentText }} />
          </summary>
          <p className="pb-5 leading-relaxed" style={{ color: theme.muted }}>{faq.answer}</p>
        </details>
      ))}
    </div>
  </section>
);
