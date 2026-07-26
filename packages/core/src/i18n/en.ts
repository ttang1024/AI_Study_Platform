/**
 * Base locale. Every other locale is a Partial of this, so adding a key here without translating it
 * elsewhere falls back to English rather than rendering the raw key at the user.
 */
export const en = {
  'nav.summarizer': 'AI Summarizer',
  'nav.dashboard': 'Dashboard',
  'nav.insights': 'Insights',
  'nav.library': 'Library',
  'nav.flashcards': 'Flashcards',
  'nav.quizzes': 'Quizzes',
  'nav.practice': 'Practice',
  // Check Working / Writing / Language are tabs of one page now, not three nav entries.
  'nav.tools': 'Study Tools',
  'nav.planner': 'Planner',
  'nav.glossary': 'Glossary',
  'nav.notes': 'Notes',
  'nav.chat': 'AI Chat',
  'nav.knowledgeGraph': 'Knowledge Graph',
  'nav.groups': 'Study Groups',
  'nav.classrooms': 'Classrooms',
  'nav.search': 'Search',
  'nav.settings': 'Settings',
  'nav.signOut': 'Sign Out',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.close': 'Close',

  'settings.language': 'Language',
  'settings.languageHelp': 'Changes the interface language. Your study material is not translated.',

  'translate.title': 'Translate',
  'translate.action': 'Translate this',
  'translate.into': 'Translate into',
  'translate.working': 'Translating…',
  'translate.failed': 'Could not translate that. Please try again.',
  'translate.disclaimer': 'Machine translation — check anything you rely on.',
} as const;

export type TranslationKey = keyof typeof en;
