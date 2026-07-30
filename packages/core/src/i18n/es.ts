import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const es: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'Resumen con IA',
  'nav.dashboard': 'Panel',
  'nav.insights': 'Estadísticas',
  'nav.library': 'Biblioteca',
  'nav.practiceCenter': 'Centro de práctica',
  'nav.materials': 'Materiales',
  'nav.spaces': 'Espacios',
  'nav.flashcards': 'Tarjetas',
  'nav.quizzes': 'Cuestionarios',
  'nav.practice': 'Práctica',
  'nav.tools': 'Herramientas',
  'nav.planner': 'Planificador',
  'nav.glossary': 'Glosario',
  'nav.notes': 'Notas',
  'nav.chat': 'Chat con IA',
  'nav.knowledgeGraph': 'Mapa de conocimiento',
  'nav.groups': 'Grupos de estudio',
  'nav.classrooms': 'Clases',
  'nav.search': 'Buscar',
  'nav.settings': 'Ajustes',
  'nav.signOut': 'Cerrar sesión',

  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'common.delete': 'Eliminar',
  'common.loading': 'Cargando…',
  'common.retry': 'Reintentar',
  'common.close': 'Cerrar',

  'settings.language': 'Idioma',
  'settings.languageHelp': 'Cambia el idioma de la interfaz. Tu material de estudio no se traduce.',

  'translate.title': 'Traducir',
  'translate.action': 'Traducir esto',
  'translate.into': 'Traducir a',
  'translate.working': 'Traduciendo…',
  'translate.failed': 'No se pudo traducir. Inténtalo de nuevo.',
  'translate.disclaimer': 'Traducción automática: verifica lo que sea importante.',
  'translate.showOriginal': 'Ver original',
};
