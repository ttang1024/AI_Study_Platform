import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const ko: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'AI 요약',
  'nav.dashboard': '대시보드',
  'nav.insights': '학습 분석',
  'nav.library': '라이브러리',
  'nav.practiceCenter': '연습 센터',
  'nav.spaces': '스페이스',
  'nav.flashcards': '플래시카드',
  'nav.planner': '플래너',
  'nav.glossary': '용어집',
  'nav.notes': '노트',
  'nav.chat': 'AI 채팅',
  'nav.search': '검색',
  'nav.settings': '설정',

  'settings.language': '언어',
  'settings.languageHelp': '인터페이스 언어를 변경합니다. 학습 자료는 번역되지 않습니다.',

  'translate.action': '이 내용 번역',
  'translate.into': '번역할 언어',
  'translate.working': '번역 중…',
  'translate.failed': '번역하지 못했습니다. 다시 시도해 주세요.',
  'translate.disclaimer': '기계 번역입니다. 중요한 내용은 꼭 확인하세요.',
  'translate.showOriginal': '원문 보기',
};
