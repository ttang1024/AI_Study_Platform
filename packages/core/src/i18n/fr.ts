import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const fr: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'Résumé IA',
  'nav.dashboard': 'Tableau de bord',
  'nav.insights': 'Statistiques',
  'nav.library': 'Bibliothèque',
  'nav.practiceCenter': "Centre d'entraînement",
  'nav.spaces': 'Espaces',
  'nav.flashcards': 'Cartes mémo',
  'nav.planner': 'Planificateur',
  'nav.glossary': 'Glossaire',
  'nav.notes': 'Notes',
  'nav.chat': 'Chat IA',
  'nav.search': 'Rechercher',
  'nav.settings': 'Paramètres',

  'settings.language': 'Langue',
  'settings.languageHelp':
    "Change la langue de l'interface. Vos supports d'étude ne sont pas traduits.",

  'translate.action': 'Traduire ceci',
  'translate.into': 'Traduire en',
  'translate.working': 'Traduction…',
  'translate.failed': 'Impossible de traduire. Veuillez réessayer.',
  'translate.disclaimer': 'Traduction automatique : vérifiez ce qui compte.',
  'translate.showOriginal': "Voir l'original",
};
