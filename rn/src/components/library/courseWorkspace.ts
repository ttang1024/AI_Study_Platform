import BookMarked from 'lucide-react-native/icons/book-marked';
import BrainCircuit from 'lucide-react-native/icons/brain-circuit';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import NotebookPen from 'lucide-react-native/icons/notebook-pen';
import type { LucideIcon } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import type { Flashcard, GlossaryTerm, Note, QuizQuestion } from '@/types';
import { cardBackText, cardFrontText } from '@/utils/flashcardDisplay';
import { stripHtml } from '@/utils/stripHtml';

export type Mode = 'materials' | 'artifacts';
export type ArtifactKind = 'notes' | 'flashcards' | 'questions' | 'glossary';

export interface CourseArtifacts {
  notes: Note[];
  flashcards: Flashcard[];
  questions: QuizQuestion[];
  glossary: GlossaryTerm[];
}

// Fixed pixel height (see FilterChip's CHIP_HEIGHT note): the chip row's
// horizontal ScrollView needs an exact matching height, and flexShrink 0,
// or a long FlatList below compresses the row and clips the labels.
export const METRIC_CHIP_HEIGHT = 32;

export const ARTIFACT_META: { kind: ArtifactKind; label: string; icon: LucideIcon; color: string }[] = [
  { kind: 'notes', label: 'Notes', icon: NotebookPen, color: Colors.blue },
  { kind: 'flashcards', label: 'Cards', icon: BrainCircuit, color: Colors.teal },
  { kind: 'questions', label: 'Questions', icon: HelpCircle, color: Colors.amber },
  { kind: 'glossary', label: 'Glossary', icon: BookMarked, color: Colors.purple },
];

export const isArtifactKind = (v: unknown): v is ArtifactKind =>
  ARTIFACT_META.some((m) => m.kind === v);

// Questions get their own answerable rows; the read-only kinds all render as a
// generic title/body card, so derive those rows here.
export const buildArtifactRows = (
  artifacts: CourseArtifacts,
  active: ArtifactKind,
): { key: string; title: string; body: string }[] => {
  switch (active) {
    case 'notes':
      return artifacts.notes.map((n) => ({
        key: n.id, title: n.documentName ?? n.videoName ?? 'Note', body: stripHtml(n.content),
      }));
    case 'flashcards':
      return artifacts.flashcards.map((c) => ({
        key: c.id, title: cardFrontText(c), body: cardBackText(c),
      }));
    case 'questions':
      return [];
    case 'glossary':
      return artifacts.glossary.map((g) => ({
        key: g.id, title: g.term, body: g.definition,
      }));
  }
};
