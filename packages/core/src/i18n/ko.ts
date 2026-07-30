import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const ko: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'AI 요약',
  'nav.dashboard': '대시보드',
  'nav.insights': '학습 분석',
  'nav.library': '라이브러리',
  'nav.practiceCenter': '연습 센터',
  'nav.materials': '학습 자료',
  'nav.spaces': '스페이스',
  'nav.flashcards': '플래시카드',
  'nav.quizzes': '퀴즈',
  'nav.practice': '연습',
  'nav.tools': '학습 도구',
  'nav.planner': '플래너',
  'nav.glossary': '용어집',
  'nav.notes': '노트',
  'nav.chat': 'AI 채팅',
  'nav.knowledgeGraph': '지식 그래프',
  'nav.groups': '스터디 그룹',
  'nav.classrooms': '클래스',
  'nav.search': '검색',
  'nav.settings': '설정',
  'nav.signOut': '로그아웃',

  'common.save': '저장',
  'common.cancel': '취소',
  'common.delete': '삭제',
  'common.loading': '불러오는 중…',
  'common.retry': '다시 시도',
  'common.close': '닫기',

  'settings.language': '언어',
  'settings.languageHelp': '인터페이스 언어를 변경합니다. 학습 자료는 번역되지 않습니다.',

  'translate.title': '번역',
  'translate.action': '이 내용 번역',
  'translate.into': '번역할 언어',
  'translate.working': '번역 중…',
  'translate.failed': '번역하지 못했습니다. 다시 시도해 주세요.',
  'translate.disclaimer': '기계 번역입니다. 중요한 내용은 꼭 확인하세요.',
  'translate.showOriginal': '원문 보기',
};
