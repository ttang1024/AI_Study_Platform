import Award from 'lucide-react-native/icons/award';
import BookMarked from 'lucide-react-native/icons/book-marked';
import BrainCircuit from 'lucide-react-native/icons/brain-circuit';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Sigma from 'lucide-react-native/icons/sigma';
import type { LucideIcon } from 'lucide-react-native';

import { Colors } from '@/constants/theme';
import type { PracticeQuestion, PracticeResultItem, PracticeSource, PracticeTestSummary } from '@/services/practiceService';

// Mirrors web's components/practice/practiceMeta.ts.
export const SOURCE_META: Record<PracticeSource, { label: string; desc: string; icon: LucideIcon; color: string }> = {
  quiz: { label: 'Quiz bank', desc: 'Multiple choice, auto-graded', icon: Award, color: Colors.amber },
  flashcard: { label: 'Flashcards', desc: 'Front → back recall', icon: BrainCircuit, color: Colors.teal },
  glossary: { label: 'Glossary', desc: 'Term → definition', icon: BookMarked, color: Colors.blue },
  problem: { label: 'Worked problems', desc: 'Solve & self-check', icon: Sigma, color: Colors.purple },
  mistake: { label: 'Mistake redo', desc: 'Questions you previously missed', icon: RotateCcw, color: Colors.red },
};

// The configurable test draws from these; 'mistake' only appears inside smart sessions.
export const ALL_SOURCES: PracticeSource[] = ['quiz', 'flashcard', 'glossary', 'problem'];
export const COUNT_OPTIONS = [10, 15, 25, 40];

export type Phase = 'setup' | 'running' | 'report';

// Chart flashcards store a chart-spec JSON as their answer — RN has no chart renderer,
// so degrade to a placeholder (same policy as utils/flashcardDisplay.ts).
export const isChartAnswer = (answer: string) => {
  if (!answer.trimStart().startsWith('{')) return false;
  try {
    const parsed = JSON.parse(answer);
    return !!(parsed?.labels && parsed?.datasets);
  } catch {
    return false;
  }
};

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export interface PracticeReport {
  total: number;
  correct: number;
  pct: number;
  missed: PracticeQuestion[];
  bySource: { s: PracticeSource; total: number; correct: number }[];
}

// Pure derivation of the report screen from raw run state — locally computed even when
// server persistence of the summary fails.
export const buildReport = (
  summary: PracticeTestSummary | null,
  results: PracticeResultItem[],
  questions: PracticeQuestion[],
): PracticeReport => {
  const total = summary?.total ?? results.length;
  const correct = summary?.correct ?? results.filter((r) => r.isCorrect).length;
  const pct = summary?.accuracyPercent ?? (total ? Math.round((correct * 1000) / total) / 10 : 0);
  const missed = questions.filter((_, i) => results[i] && !results[i].isCorrect);
  const bySource = (ALL_SOURCES as PracticeSource[])
    .concat('mistake')
    .map((s) => {
      const items = results.filter((r) => r.source === s);
      return { s, total: items.length, correct: items.filter((r) => r.isCorrect).length };
    })
    .filter((x) => x.total > 0);
  return { total, correct, pct, missed, bySource };
};
