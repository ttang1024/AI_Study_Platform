import React from 'react';
import {
  RotateCcw, BrainCircuit, Award, BookMarked, Sigma,
} from 'lucide-react';
import type { PracticeSource } from '../../services/practiceService';

/** Chart flashcards store a ChartDefinition JSON as their answer — render it, don't print it. */
export const isChartAnswer = (answer: string) => {
  if (!answer.trimStart().startsWith('{')) return false;
  try {
    const parsed = JSON.parse(answer);
    return !!(parsed?.labels && parsed?.datasets);
  } catch {
    return false;
  }
};

export const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';

export const SOURCE_META: Record<PracticeSource, { label: string; desc: string; icon: React.ElementType; color: string }> = {
  quiz: { label: 'Quiz bank', desc: 'Multiple choice, auto-graded', icon: Award, color: '#d97706' },
  flashcard: { label: 'Flashcards', desc: 'Front → back recall', icon: BrainCircuit, color: '#0d9488' },
  glossary: { label: 'Glossary', desc: 'Term → definition', icon: BookMarked, color: '#2563eb' },
  problem: { label: 'Worked problems', desc: 'Solve & self-check', icon: Sigma, color: '#7c3aed' },
  mistake: { label: 'Mistake redo', desc: 'Questions you previously missed', icon: RotateCcw, color: '#dc2626' },
};
// The configurable test draws from these; 'mistake' only appears inside smart sessions.
export const ALL_SOURCES = ['quiz', 'flashcard', 'glossary', 'problem'] as PracticeSource[];

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
