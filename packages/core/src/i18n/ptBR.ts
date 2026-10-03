import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const ptBR: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'Resumo com IA',
  'nav.dashboard': 'Painel',
  'nav.insights': 'Estatísticas',
  'nav.library': 'Biblioteca',
  'nav.practiceCenter': 'Central de prática',
  'nav.spaces': 'Espaços',
  'nav.flashcards': 'Flashcards',
  'nav.planner': 'Planejador',
  'nav.glossary': 'Glossário',
  'nav.notes': 'Notas',
  'nav.chat': 'Chat com IA',
  'nav.search': 'Buscar',
  'nav.settings': 'Configurações',

  'settings.language': 'Idioma',
  'settings.languageHelp':
    'Altera o idioma da interface. Seu material de estudo não é traduzido.',

  'translate.action': 'Traduzir isto',
  'translate.into': 'Traduzir para',
  'translate.working': 'Traduzindo…',
  'translate.failed': 'Não foi possível traduzir. Tente novamente.',
  'translate.disclaimer': 'Tradução automática: confira o que for importante.',
  'translate.showOriginal': 'Ver original',
};
