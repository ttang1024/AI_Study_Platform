// Achievement catalog shared by web (AchievementsPanel + localStorage newly-unlocked
// detection) and rn (study/achievements screen). Every condition is a monotonic
// counter over /api/stats data, so unlocked-ness is derivable with no storage.
//
// `AchievementProgress` is a structural subset of the stats service's `UserStats` —
// rn passes a `UserStats` straight in; web builds one from StudyContext counters.

export interface AchievementProgress {
  totalFlashcards: number;
  totalQuizSubmissions: number;
  totalNotes: number;
  totalDocuments: number;
  achievements: {
    perfectQuizzes: number;
    averageQuizScore: number;
    flashcardsMastered: number;
  };
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'flashcards' | 'quizzes' | 'notes' | 'documents';
  condition: (stats: AchievementProgress) => boolean;
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
