import type { UserStats } from '@/types';

// Catalog ported from web's services/achievementsService.ts. Web additionally
// persists an "unlocked" list in localStorage, but only to detect *newly*
// unlocked items for a toast — every condition is a monotonic counter, so
// unlocked-ness itself is derivable from live /api/stats data with no storage.
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'flashcards' | 'quizzes' | 'notes' | 'documents';
  condition: (stats: UserStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_flashcard', title: 'First Card', description: 'Create your first flashcard', icon: '🃏', category: 'flashcards', condition: (s) => s.totalFlashcards >= 1 },
  { id: 'flashcard_10', title: 'Card Collector', description: 'Have 10 flashcards', icon: '📚', category: 'flashcards', condition: (s) => s.totalFlashcards >= 10 },
  { id: 'flashcard_50', title: 'Deck Builder', description: 'Have 50 flashcards', icon: '🗂️', category: 'flashcards', condition: (s) => s.totalFlashcards >= 50 },
  { id: 'flashcard_mastered_5', title: 'Memory Master', description: 'Master 5 flashcards', icon: '🧠', category: 'flashcards', condition: (s) => s.achievements.flashcardsMastered >= 5 },
  { id: 'first_quiz', title: 'Quiz Taker', description: 'Complete your first quiz', icon: '📝', category: 'quizzes', condition: (s) => s.totalQuizSubmissions >= 1 },
  { id: 'perfect_quiz', title: 'Perfectionist', description: 'Score 100% on a quiz', icon: '⭐', category: 'quizzes', condition: (s) => s.achievements.perfectQuizzes >= 1 },
  { id: 'quiz_10', title: 'Quiz Champion', description: 'Complete 10 quizzes', icon: '🏆', category: 'quizzes', condition: (s) => s.totalQuizSubmissions >= 10 },
  { id: 'avg_score_80', title: 'High Achiever', description: 'Maintain 80%+ average quiz score (3+ quizzes)', icon: '🎯', category: 'quizzes', condition: (s) => s.achievements.averageQuizScore >= 80 && s.totalQuizSubmissions >= 3 },
  { id: 'first_note', title: 'Note Taker', description: 'Write your first note', icon: '✏️', category: 'notes', condition: (s) => s.totalNotes >= 1 },
  { id: 'notes_10', title: 'Scholar', description: 'Write 10 notes', icon: '📖', category: 'notes', condition: (s) => s.totalNotes >= 10 },
  { id: 'doc_5', title: 'Collector', description: 'Upload 5 documents', icon: '📂', category: 'documents', condition: (s) => s.totalDocuments >= 5 },
];
