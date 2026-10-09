/**
 * The feature page slugs on their own, so App.tsx can declare the routes without pulling every
 * page's copy into the entry chunk. The content lives in featurePages.ts, typed against this list.
 */
export const FEATURE_PAGE_SLUGS = [
	'ai-flashcard-generator',
	'ai-quiz-generator',
	'ai-pdf-summary',
	'ai-youtube-summary',
	'spaced-repetition-app',
	'ai-mind-map-generator',
] as const

export type FeaturePageSlug = (typeof FEATURE_PAGE_SLUGS)[number]
