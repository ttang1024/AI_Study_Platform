import type React from 'react';
import type { FeaturePageSlug } from '../../seo/featurePageSlugs';

/**
 * Each public feature page gets its own visual identity, picked to echo what the feature does:
 * index cards for flashcards, answer tiles for quizzes, a paper page for PDF summaries, a video
 * timeline for YouTube, review intervals for spaced repetition and branches for mind maps.
 *
 * The copy stays in seo/featurePages.ts (plain data that vite.config.ts also reads); this file only
 * decides how that copy is laid out and coloured.
 */
export type StepsLayout = 'deck' | 'progress' | 'numbered' | 'timeline' | 'branch';
export type SectionsLayout = 'index-cards' | 'options' | 'document' | 'chapters' | 'tiles' | 'nodes';

export type FeatureTheme = {
  /** Page background, plus an optional texture layered over it. */
  background: string;
  texture?: string;
  textureSize?: string;
  text: string;
  muted: string;
  /** Hairline borders, card fills and the soft drop shadow cards sit on. */
  line: string;
  surface: string;
  cardShadow: string;
  accent: string;
  /** A deeper accent, readable as text on the light background. */
  accentText: string;
  accentSoft: string;
  ctaBackground: string;
  ctaShadow: string;
  headingFont: string;
  eyebrow: string;
  /** split: copy left, demo right; reverse: the other way round; stacked: copy above a wide demo. */
  heroLayout: 'split' | 'reverse' | 'stacked';
  stepsHeading: string;
  steps: StepsLayout;
  /** Labels shown on the timeline steps (timestamps, review days). */
  stepLabels?: string[];
  sections: SectionsLayout;
};

/** The white card every section and demo panel sits on. */
export const cardStyle = (theme: FeatureTheme): React.CSSProperties => ({
  background: theme.surface,
  border: `1px solid ${theme.line}`,
  boxShadow: theme.cardShadow,
});

const SANS = 'Inter, system-ui, sans-serif';

/**
 * Every page is light: white cards on a near-white page washed with the page's accent at the top,
 * slate text, and the landing page's cyan/teal/blue accents and CTA gradient so they still read as
 * one product. What changes per page is the wash, the texture, the accent shade, the heading font
 * and the layouts.
 */
const BASE = {
  background: 'linear-gradient(180deg, #f0f9ff 0px, #ffffff 900px)',
  text: '#0f172a',
  muted: '#475569',
  line: '#e2e8f0',
  surface: '#ffffff',
  cardShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(15,23,42,0.08)',
  ctaBackground: 'linear-gradient(135deg, #059669, #0891b2)',
  ctaShadow: '0 12px 28px -8px rgba(8,145,178,0.45)',
};

const CYAN = { accent: '#06b6d4', accentText: '#0e7490', accentSoft: '#ecfeff' };
const SKY = { accent: '#0ea5e9', accentText: '#0369a1', accentSoft: '#e0f2fe' };
const BLUE = { accent: '#3b82f6', accentText: '#1d4ed8', accentSoft: '#dbeafe' };
const TEAL = { accent: '#14b8a6', accentText: '#0f766e', accentSoft: '#ccfbf1' };

const GRID = (rgb: string, size: string) => ({
  texture: `linear-gradient(rgba(${rgb},0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(${rgb},0.08) 1px, transparent 1px)`,
  textureSize: size,
});

export const FEATURE_THEMES: Record<FeaturePageSlug, FeatureTheme> = {
  'ai-flashcard-generator': {
    ...BASE,
    ...CYAN,
    background: 'radial-gradient(1400px 800px at 15% 0%, #cffafe 0%, #f0fdff 45%, #ffffff 100%)',
    texture: 'radial-gradient(rgba(8,145,178,0.16) 1px, transparent 1px)',
    textureSize: '22px 22px',
    headingFont: 'Quicksand, sans-serif',
    eyebrow: 'Flashcards',
    heroLayout: 'split',
    stepsHeading: 'From notes to a deck in three moves',
    steps: 'deck',
    sections: 'index-cards',
  },
  'ai-quiz-generator': {
    ...BASE,
    ...SKY,
    ...GRID('56,189,248', '48px 48px'),
    background: 'linear-gradient(170deg, #e0f2fe 0px, #f8fbff 450px, #ffffff 900px)',
    headingFont: SANS,
    eyebrow: 'Practice quizzes',
    heroLayout: 'reverse',
    stepsHeading: 'How a quiz comes together',
    steps: 'progress',
    sections: 'options',
  },
  'ai-pdf-summary': {
    ...BASE,
    ...TEAL,
    background: 'linear-gradient(180deg, #f0fdfa 0px, #fbfdfc 450px, #ffffff 900px)',
    texture: 'repeating-linear-gradient(0deg, transparent 0 31px, rgba(20,184,166,0.1) 31px 32px)',
    headingFont: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
    eyebrow: 'PDF summaries',
    heroLayout: 'split',
    stepsHeading: 'How it works',
    steps: 'numbered',
    sections: 'document',
  },
  'ai-youtube-summary': {
    ...BASE,
    ...CYAN,
    background: 'linear-gradient(180deg, #ecfeff 0px, #f8fdff 450px, #ffffff 900px)',
    headingFont: SANS,
    eyebrow: 'Video summaries',
    heroLayout: 'split',
    stepsHeading: 'From link to notes',
    steps: 'timeline',
    stepLabels: ['0:00', '0:05', '0:30'],
    sections: 'chapters',
  },
  'spaced-repetition-app': {
    ...BASE,
    ...BLUE,
    ...GRID('96,165,250', '24px 24px'),
    background: 'radial-gradient(1400px 800px at 85% 0%, #dbeafe 0%, #f5f9ff 45%, #ffffff 100%)',
    line: '#dbe4f0',
    headingFont: "'JetBrains Mono', ui-monospace, monospace",
    eyebrow: 'Spaced repetition',
    heroLayout: 'reverse',
    stepsHeading: 'Review less, remember more',
    steps: 'timeline',
    stepLabels: ['Day 1', 'Day 4', 'Day 17'],
    sections: 'tiles',
  },
  'ai-mind-map-generator': {
    ...BASE,
    ...TEAL,
    background: 'radial-gradient(1200px 900px at 50% 10%, #ccfbf1 0%, #f0fdfa 45%, #ffffff 100%)',
    line: '#d5e9e6',
    headingFont: 'Quicksand, sans-serif',
    eyebrow: 'Mind maps',
    heroLayout: 'stacked',
    stepsHeading: 'How the map grows',
    steps: 'branch',
    sections: 'nodes',
  },
};
