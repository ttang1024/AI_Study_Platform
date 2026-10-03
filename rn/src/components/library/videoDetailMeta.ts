import Bot from 'lucide-react-native/icons/bot';
import Captions from 'lucide-react-native/icons/captions';
import FileText from 'lucide-react-native/icons/file-text';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import Layers from 'lucide-react-native/icons/layers';
import ListChecks from 'lucide-react-native/icons/list-checks';
import NotebookPen from 'lucide-react-native/icons/notebook-pen';
import Sparkles from 'lucide-react-native/icons/sparkles';

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
