import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const zhCN: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'AI 摘要',
  'nav.dashboard': '仪表板',
  'nav.insights': '学习分析',
  'nav.library': '资料库',
  'nav.practiceCenter': '练习中心',
  'nav.materials': '学习材料',
  'nav.spaces': '空间',
  'nav.flashcards': '记忆卡',
  'nav.quizzes': '测验',
  'nav.practice': '练习',
  'nav.tools': '学习工具',
  'nav.planner': '计划表',
  'nav.glossary': '术语表',
  'nav.notes': '笔记',
  'nav.chat': 'AI 对话',
  'nav.knowledgeGraph': '知识图谱',
  'nav.groups': '学习小组',
  'nav.classrooms': '班级',
  'nav.search': '搜索',
  'nav.settings': '设置',
  'nav.signOut': '退出登录',

  'common.save': '保存',
  'common.cancel': '取消',
  'common.delete': '删除',
  'common.loading': '加载中…',
  'common.retry': '重试',
  'common.close': '关闭',

  'settings.language': '语言',
  'settings.languageHelp': '更改界面语言。你的学习材料不会被翻译。',

  'translate.title': '翻译',
  'translate.action': '翻译这段内容',
  'translate.into': '翻译为',
  'translate.working': '翻译中…',
  'translate.failed': '翻译失败，请重试。',
  'translate.disclaimer': '机器翻译，重要内容请自行核对。',
  'translate.showOriginal': '查看原文',
};
