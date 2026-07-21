import { Bot, Captions, FileText, Layers, ListChecks, NotebookPen, Sparkles, HelpCircle } from 'lucide-react-native';

export type Tab = 'summary' | 'transcript' | 'chat' | 'notes' | 'glossary' | 'cards' | 'quiz' | 'practice';

export const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'transcript', label: 'Transcript', icon: Captions },
  { id: 'chat', label: 'Chat', icon: Bot },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'glossary', label: 'Glossary', icon: Sparkles },
  { id: 'cards', label: 'Cards', icon: Layers },
  { id: 'quiz', label: 'Quiz', icon: HelpCircle },
  { id: 'practice', label: 'Practice', icon: ListChecks },
];

export const isKnownTab = (v: unknown): v is Tab => TABS.some((t) => t.id === v);

/** Imperative seek surface a player exposes to the summary timeline. */
export type SeekHandle = { seek: (seconds: number) => void };
