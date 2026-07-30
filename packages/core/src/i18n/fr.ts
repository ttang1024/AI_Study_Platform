import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const fr: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'Résumé IA',
  'nav.dashboard': 'Tableau de bord',
  'nav.insights': 'Statistiques',
  'nav.library': 'Bibliothèque',
  'nav.practiceCenter': "Centre d'entraînement",
  'nav.materials': 'Supports',
  'nav.spaces': 'Espaces',
  'nav.flashcards': 'Cartes mémo',
  'nav.quizzes': 'Quiz',
  'nav.practice': 'Entraînement',
  'nav.tools': 'Outils',
  'nav.planner': 'Planificateur',
  'nav.glossary': 'Glossaire',
  'nav.notes': 'Notes',
  'nav.chat': 'Chat IA',
  'nav.knowledgeGraph': 'Carte des connaissances',
  'nav.groups': "Groupes d'étude",
  'nav.classrooms': 'Classes',
  'nav.search': 'Rechercher',
  'nav.settings': 'Paramètres',
  'nav.signOut': 'Se déconnecter',

  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.delete': 'Supprimer',
  'common.loading': 'Chargement…',
  'common.retry': 'Réessayer',
  'common.close': 'Fermer',

  'settings.language': 'Langue',
  'settings.languageHelp':
    "Change la langue de l'interface. Vos supports d'étude ne sont pas traduits.",

  'translate.title': 'Traduire',
  'translate.action': 'Traduire ceci',
  'translate.into': 'Traduire en',
  'translate.working': 'Traduction…',
  'translate.failed': 'Impossible de traduire. Veuillez réessayer.',
  'translate.disclaimer': 'Traduction automatique : vérifiez ce qui compte.',
  'translate.showOriginal': "Voir l'original",
};
