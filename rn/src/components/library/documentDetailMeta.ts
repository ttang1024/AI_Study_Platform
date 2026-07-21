import { BookOpen, Bot, Brain, FileImage, FileText, Headphones, Highlighter, Layers, ListChecks, NotebookPen, Presentation, Sparkles, HelpCircle } from 'lucide-react-native';

import type { Document } from '@/types';

export type Tab = 'summary' | 'chat' | 'mindmap' | 'highlights' | 'notes' | 'glossary' | 'cards' | 'quiz' | 'practice';

export const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'mindmap', label: 'Mind Map', icon: Brain },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'glossary', label: 'Glossary', icon: Sparkles },
  { id: 'cards', label: 'Cards', icon: Layers },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'practice', label: 'Practice', icon: ListChecks },
];

// Highlighting needs a rendered PDF page — text-based docs don't get the tab.
export const HIGHLIGHTS_TAB = { id: 'highlights' as Tab, label: 'Highlights', icon: Highlighter };

export const TYPE_ICON: Record<Document['type'], typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  audio: Headphones,
  podcast: Headphones,
  image: FileImage,
  ppt: Presentation,
  epub: BookOpen,
};

// PDFs gain the Highlights tab (inserted after Mind Map); other types don't.
export const resolveTabs = (isPdf: boolean) =>
  isPdf ? [...TABS.slice(0, 3), HIGHLIGHTS_TAB, ...TABS.slice(3)] : TABS;

export const isKnownTab = (v: unknown): v is Tab =>
  TABS.some((t) => t.id === v) || v === HIGHLIGHTS_TAB.id;

export const formatUploadDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
