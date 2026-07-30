import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const de: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'KI-Zusammenfassung',
  'nav.dashboard': 'Übersicht',
  'nav.insights': 'Statistiken',
  'nav.library': 'Bibliothek',
  'nav.practiceCenter': 'Übungszentrum',
  'nav.materials': 'Materialien',
  'nav.spaces': 'Räume',
  'nav.flashcards': 'Karteikarten',
  'nav.quizzes': 'Quiz',
  'nav.practice': 'Üben',
  'nav.tools': 'Werkzeuge',
  'nav.planner': 'Planer',
  'nav.glossary': 'Glossar',
  'nav.notes': 'Notizen',
  'nav.chat': 'KI-Chat',
  'nav.knowledgeGraph': 'Wissenslandkarte',
  'nav.groups': 'Lerngruppen',
  'nav.classrooms': 'Kurse',
  'nav.search': 'Suche',
  'nav.settings': 'Einstellungen',
  'nav.signOut': 'Abmelden',

  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.delete': 'Löschen',
  'common.loading': 'Wird geladen…',
  'common.retry': 'Erneut versuchen',
  'common.close': 'Schließen',

  'settings.language': 'Sprache',
  'settings.languageHelp':
    'Ändert die Sprache der Oberfläche. Deine Lernmaterialien werden nicht übersetzt.',

  'translate.title': 'Übersetzen',
  'translate.action': 'Das übersetzen',
  'translate.into': 'Übersetzen nach',
  'translate.working': 'Wird übersetzt…',
  'translate.failed': 'Übersetzung fehlgeschlagen. Bitte versuche es erneut.',
  'translate.disclaimer': 'Maschinelle Übersetzung – prüfe, worauf du dich verlässt.',
  'translate.showOriginal': 'Original anzeigen',
};
