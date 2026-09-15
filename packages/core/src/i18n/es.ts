import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const es: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'Resumen con IA',
  'nav.dashboard': 'Panel',
  'nav.insights': 'Estadísticas',
  'nav.library': 'Biblioteca',
  'nav.practiceCenter': 'Centro de práctica',
  'nav.spaces': 'Espacios',
  'nav.flashcards': 'Tarjetas',
  'nav.planner': 'Planificador',
  'nav.glossary': 'Glosario',
  'nav.notes': 'Notas',
  'nav.chat': 'Chat con IA',
  'nav.search': 'Buscar',
  'nav.settings': 'Ajustes',

  'settings.language': 'Idioma',
  'settings.languageHelp': 'Cambia el idioma de la interfaz. Tu material de estudio no se traduce.',

  'translate.action': 'Traducir esto',
  'translate.into': 'Traducir a',
  'translate.working': 'Traduciendo…',
  'translate.failed': 'No se pudo traducir. Inténtalo de nuevo.',
  'translate.disclaimer': 'Traducción automática: verifica lo que sea importante.',
  'translate.showOriginal': 'Ver original',
};
