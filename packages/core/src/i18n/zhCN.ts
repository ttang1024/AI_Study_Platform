import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const zhCN: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'AI 摘要',
  'nav.dashboard': '仪表板',
  'nav.insights': '学习分析',
  'nav.library': '资料库',
  'nav.practiceCenter': '练习中心',
  'nav.spaces': '空间',
  'nav.flashcards': '记忆卡',
  'nav.planner': '计划表',
  'nav.glossary': '术语表',
  'nav.notes': '笔记',
  'nav.chat': 'AI 对话',
  'nav.search': '搜索',
  'nav.settings': '设置',

  'settings.language': '语言',
  'settings.languageHelp': '更改界面语言。你的学习材料不会被翻译。',

  'translate.action': '翻译这段内容',
  'translate.into': '翻译为',
  'translate.working': '翻译中…',
  'translate.failed': '翻译失败，请重试。',
  'translate.disclaimer': '机器翻译，重要内容请自行核对。',
  'translate.showOriginal': '查看原文',
};
