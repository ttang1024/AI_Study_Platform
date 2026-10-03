/**
 * Base locale. Every other locale is a Partial of this, so adding a key here without translating it
 * elsewhere falls back to English rather than rendering the raw key at the user.
 */
export const en = {
  'nav.dashboard': 'Dashboard',
  'nav.insights': 'Insights',
  'nav.library': 'Library',
  // Adding content is its own page again, so the web nav shows this next to the library.
  'nav.summarizer': 'Summarizer',
  // The web nav shows merged hubs, so one key labels a page that used to be several tabs.
  // Notes and Glossary stay separate nav entries on both web and mobile.
  'nav.practiceCenter': 'Practice Center',
  'nav.spaces': 'Spaces',
  'nav.flashcards': 'Flashcards',
  // Check Working / Writing / Language are tabs of one page now, not three nav entries.
  'nav.planner': 'Planner',
  'nav.glossary': 'Glossary',
  'nav.notes': 'Notes',
  'nav.chat': 'AI Chat',
  'nav.search': 'Search',
  'nav.settings': 'Settings',

  'settings.language': 'Language',
  'settings.languageHelp': 'Changes the interface language. Your study material is not translated.',

  'translate.action': 'Translate this',
  'translate.into': 'Translate into',
  'translate.working': 'Translating…',
  'translate.failed': 'Could not translate that. Please try again.',
  'translate.disclaimer': 'Machine translation — check anything you rely on.',
  'translate.showOriginal': 'Show original',
} as const;

export type TranslationKey = keyof typeof en;
