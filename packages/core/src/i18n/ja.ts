import type { en } from './en';

/** Partial by design: any key left out falls back to English. */
export const ja: Partial<Record<keyof typeof en, string>> = {
  'nav.summarizer': 'AI要約',
  'nav.dashboard': 'ダッシュボード',
  'nav.insights': '分析',
  'nav.library': 'ライブラリ',
  'nav.practiceCenter': '演習センター',
  'nav.materials': '教材',
  'nav.spaces': 'スペース',
  'nav.flashcards': '単語カード',
  'nav.quizzes': 'クイズ',
  'nav.practice': '演習',
  'nav.tools': '学習ツール',
  'nav.planner': 'プランナー',
  'nav.glossary': '用語集',
  'nav.notes': 'ノート',
  'nav.chat': 'AIチャット',
  'nav.knowledgeGraph': 'ナレッジグラフ',
  'nav.groups': '学習グループ',
  'nav.classrooms': 'クラス',
  'nav.search': '検索',
  'nav.settings': '設定',
  'nav.signOut': 'ログアウト',

  'common.save': '保存',
  'common.cancel': 'キャンセル',
  'common.delete': '削除',
  'common.loading': '読み込み中…',
  'common.retry': '再試行',
  'common.close': '閉じる',

  'settings.language': '言語',
  'settings.languageHelp': 'インターフェースの言語を変更します。学習教材は翻訳されません。',

  'translate.title': '翻訳',
  'translate.action': 'これを翻訳',
  'translate.into': '翻訳先',
  'translate.working': '翻訳中…',
  'translate.failed': '翻訳できませんでした。もう一度お試しください。',
  'translate.disclaimer': '機械翻訳です。重要な内容は必ず確認してください。',
  'translate.showOriginal': '原文を表示',
};
