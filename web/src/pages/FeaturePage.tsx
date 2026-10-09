import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { Logo, LOGO_STYLES } from '../components/landing/Logo';
import { useOptionalAuth } from '../context/AuthContext';
import { FEATURE_PAGES, featurePagePath, type FeaturePageContent } from '../seo/featurePages';
import type { FeaturePageSlug } from '../seo/featurePageSlugs';
import { FEATURE_THEMES, cardStyle, type FeatureTheme } from '../components/feature-pages/theme';
import { FeatureBenefits, FeatureExamples, FeatureFaq, FeatureSteps } from '../components/feature-pages/FeatureSections';
import { FlashcardHero } from '../components/feature-pages/heroes/FlashcardHero';
import { QuizHero } from '../components/feature-pages/heroes/QuizHero';
import { PdfSummaryHero } from '../components/feature-pages/heroes/PdfSummaryHero';
import { VideoSummaryHero } from '../components/feature-pages/heroes/VideoSummaryHero';
import { SpacedRepetitionHero } from '../components/feature-pages/heroes/SpacedRepetitionHero';
import { MindMapHero } from '../components/feature-pages/heroes/MindMapHero';

/** The texture only sits behind the hero, fading out before the first section. */
const TEXTURE_FADE = 'linear-gradient(180deg, black 0px, transparent 900px)';

/** The interactive demo at the top of each page: a small working version of the feature. */
const HEROES: Record<FeaturePageSlug, React.FC<{ theme: FeatureTheme }>> = {
  'ai-flashcard-generator': FlashcardHero,
  'ai-quiz-generator': QuizHero,
  'ai-pdf-summary': PdfSummaryHero,
  'ai-youtube-summary': VideoSummaryHero,
  'spaced-repetition-app': SpacedRepetitionHero,
  'ai-mind-map-generator': MindMapHero,
};

/**
 * The static dist/<slug>/index.html already carries this page's title and description for the
 * first load (vite-plugin-seo.ts). This keeps them right after a client-side navigation between
 * pages, which never re-fetches the HTML.
 */
const useDocumentMeta = (page: FeaturePageContent) => {
  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    document.title = page.title;
    if (meta) meta.content = page.description;
    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
    };
  }, [page]);
};

const CtaButton: React.FC<{ label: string; theme: FeatureTheme; size?: 'sm' }> = ({ label, theme, size }) => {
  const auth = useOptionalAuth();
  const to = auth?.isAuthenticated ? '/library/add' : '/register';
  return (
    <Link to={to}
      className={`inline-flex items-center gap-2 font-bold text-white transition-transform hover:-translate-y-0.5 ${
        size === 'sm' ? 'text-sm px-5 py-2 rounded-full' : 'text-base px-7 py-3.5 rounded-2xl'}`}
      style={{ background: theme.ctaBackground, boxShadow: size === 'sm' ? undefined : theme.ctaShadow }}>
      {label}
      {size !== 'sm' && <ArrowRight className="w-4 h-4" />}
    </Link>
  );
};

const Hero: React.FC<{ page: FeaturePageContent; theme: FeatureTheme }> = ({ page, theme }) => {
  const Demo = HEROES[page.slug];
  const stacked = theme.heroLayout === 'stacked';
  const copy = (
    <div className={stacked ? 'text-center max-w-3xl mx-auto' : ''}>
      <p className="inline-block text-xs font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full mb-5"
        style={{ background: theme.accentSoft, color: theme.accentText }}>
        {theme.eyebrow}
      </p>
      <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight mb-6" style={{ fontFamily: theme.headingFont }}>
        {page.h1}
      </h1>
      <p className={`text-lg leading-relaxed mb-8 ${stacked ? 'max-w-2xl mx-auto' : ''}`} style={{ color: theme.muted }}>{page.intro}</p>
      <CtaButton label="Try it free" theme={theme} />
    </div>
  );

  if (stacked) {
    return (
      <header className="pt-14 pb-6">
        {copy}
        <div className="mt-10"><Demo theme={theme} /></div>
      </header>
    );
  }
  return (
    <header className="pt-14 pb-10 grid gap-12 lg:grid-cols-2 lg:items-center">
      <div className={theme.heroLayout === 'reverse' ? 'lg:order-2' : ''}>{copy}</div>
      <Demo theme={theme} />
    </header>
  );
};

export const FeaturePage: React.FC<{ slug: FeaturePageSlug }> = ({ slug }) => {
  // Every slug has a page; featurePages.test.ts keeps the two lists in step.
  const page = FEATURE_PAGES.find((p) => p.slug === slug)!;
  const theme = FEATURE_THEMES[slug];
  useDocumentMeta(page);
  useEffect(() => { window.scrollTo(0, 0); }, [page.slug]);
  const related = FEATURE_PAGES.filter((p) => p.slug !== page.slug);

  return (
    <MotionConfig reducedMotion="user">
      {/* overflow-x-clip, not -hidden: hidden makes this div a scroll container, and the sticky nav
          would then stick to it (it never scrolls) instead of the viewport. */}
      <div className="relative min-h-screen overflow-x-clip" style={{ background: theme.background, color: theme.text }}>
        <style>{LOGO_STYLES}</style>
        {theme.texture && (
          <div className="pointer-events-none absolute inset-0" aria-hidden
            style={{ backgroundImage: theme.texture, backgroundSize: theme.textureSize,
              maskImage: TEXTURE_FADE, WebkitMaskImage: TEXTURE_FADE }} />
        )}

        <nav className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-4"
          style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${theme.line}` }}>
          <Link to="/" aria-label="Toto Study home"><Logo studyColor="#0891b2" /></Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block text-sm font-medium px-3 py-1.5 transition-colors hover:text-slate-900" style={{ color: theme.muted }}>
              Sign in
            </Link>
            <CtaButton label="Get started free" theme={theme} size="sm" />
          </div>
        </nav>

        <main className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <Hero page={page} theme={theme} />
          <div className="max-w-5xl mx-auto">
            <FeatureSteps theme={theme} steps={page.steps} />
            {page.examples && <FeatureExamples theme={theme} examples={page.examples} />}
            <FeatureBenefits theme={theme} sections={page.sections} />
            <div className="max-w-3xl mx-auto"><FeatureFaq theme={theme} faqs={page.faqs} /></div>
          </div>

          <section className="my-14 rounded-3xl px-6 py-14 text-center"
            style={{ ...cardStyle(theme), background: `linear-gradient(135deg, ${theme.accentSoft}, #ffffff 70%)` }}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontFamily: theme.headingFont }}>Start studying smarter</h2>
            <p className="mb-8" style={{ color: theme.muted }}>Free to start. No credit card required.</p>
            <CtaButton label="Create free account" theme={theme} />
          </section>
        </main>

        <footer className="relative px-4 sm:px-6 py-10" style={{ background: '#f8fafc', borderTop: `1px solid ${theme.line}` }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-sm font-semibold mb-4" style={{ color: theme.muted }}>More from Toto Study</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              <li>
                <Link to="/" className="inline-block px-3.5 py-1.5 rounded-full bg-white transition-colors hover:bg-slate-50" style={{ border: `1px solid ${theme.line}`, color: theme.accentText }}>
                  AI study platform
                </Link>
              </li>
              {related.map((p) => (
                <li key={p.slug}>
                  <Link to={featurePagePath(p.slug)} className="inline-block px-3.5 py-1.5 rounded-full bg-white transition-colors hover:bg-slate-50"
                    style={{ border: `1px solid ${theme.line}`, color: theme.accentText }}>
                    {p.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
};
