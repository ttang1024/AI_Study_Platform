import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const ptBR: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'Resumo com IA',
  'nav.dashboard': 'Painel',
  'nav.insights': 'Estatísticas',
  'nav.library': 'Biblioteca',
  'nav.practiceCenter': 'Central de prática',
  'nav.materials': 'Materiais',
  'nav.spaces': 'Espaços',
  'nav.flashcards': 'Flashcards',
  'nav.quizzes': 'Questionários',
  'nav.practice': 'Prática',
  'nav.tools': 'Ferramentas',
  'nav.planner': 'Planejador',
  'nav.glossary': 'Glossário',
  'nav.notes': 'Notas',
  'nav.chat': 'Chat com IA',
  'nav.knowledgeGraph': 'Mapa de conhecimento',
  'nav.groups': 'Grupos de estudo',
  'nav.classrooms': 'Turmas',
  'nav.search': 'Buscar',
  'nav.settings': 'Configurações',
  'nav.signOut': 'Sair',

  'common.save': 'Salvar',
  'common.cancel': 'Cancelar',
  'common.delete': 'Excluir',
  'common.loading': 'Carregando…',
  'common.retry': 'Tentar novamente',
  'common.close': 'Fechar',

  'settings.language': 'Idioma',
  'settings.languageHelp':
    'Altera o idioma da interface. Seu material de estudo não é traduzido.',

  'translate.title': 'Traduzir',
  'translate.action': 'Traduzir isto',
  'translate.into': 'Traduzir para',
  'translate.working': 'Traduzindo…',
  'translate.failed': 'Não foi possível traduzir. Tente novamente.',
  'translate.disclaimer': 'Tradução automática: confira o que for importante.',
  'translate.showOriginal': 'Ver original',
};
