export interface AchievementStats {
  totalFlashcards: number;
  totalQuizSubmissions: number;
  totalNotes: number;
  totalDocuments: number;
  perfectQuizzes: number;
  averageQuizScore: number;
  flashcardsMastered: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'flashcards' | 'quizzes' | 'notes' | 'documents';
  condition: (stats: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_flashcard', title: 'First Card', description: 'Create your first flashcard', icon: '🃏', category: 'flashcards', condition: s => s.totalFlashcards >= 1 },
  { id: 'flashcard_10', title: 'Card Collector', description: 'Have 10 flashcards', icon: '📚', category: 'flashcards', condition: s => s.totalFlashcards >= 10 },
  { id: 'flashcard_50', title: 'Deck Builder', description: 'Have 50 flashcards', icon: '🗂️', category: 'flashcards', condition: s => s.totalFlashcards >= 50 },
  { id: 'flashcard_mastered_5', title: 'Memory Master', description: 'Master 5 flashcards', icon: '🧠', category: 'flashcards', condition: s => s.flashcardsMastered >= 5 },
  { id: 'first_quiz', title: 'Quiz Taker', description: 'Complete your first quiz', icon: '📝', category: 'quizzes', condition: s => s.totalQuizSubmissions >= 1 },
  { id: 'perfect_quiz', title: 'Perfectionist', description: 'Score 100% on a quiz', icon: '⭐', category: 'quizzes', condition: s => s.perfectQuizzes >= 1 },
  { id: 'quiz_10', title: 'Quiz Champion', description: 'Complete 10 quizzes', icon: '🏆', category: 'quizzes', condition: s => s.totalQuizSubmissions >= 10 },
  { id: 'avg_score_80', title: 'High Achiever', description: 'Maintain 80%+ average quiz score (3+ quizzes)', icon: '🎯', category: 'quizzes', condition: s => s.averageQuizScore >= 80 && s.totalQuizSubmissions >= 3 },
  { id: 'first_note', title: 'Note Taker', description: 'Write your first note', icon: '✏️', category: 'notes', condition: s => s.totalNotes >= 1 },
  { id: 'notes_10', title: 'Scholar', description: 'Write 10 notes', icon: '📖', category: 'notes', condition: s => s.totalNotes >= 10 },
  { id: 'doc_5', title: 'Collector', description: 'Upload 5 documents', icon: '📂', category: 'documents', condition: s => s.totalDocuments >= 5 },
];

const STORAGE_KEY = (userId: string) => `achievements_${userId}`;

export const achievementsService = {
  getUnlocked(userId: string): string[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY(userId)) || '[]'); }
    catch { return []; }
  },

  unlock(userId: string, achievementId: string): void {
    const current = achievementsService.getUnlocked(userId);
    if (!current.includes(achievementId)) {
      localStorage.setItem(STORAGE_KEY(userId), JSON.stringify([...current, achievementId]));
    }
  },

  checkAndUnlock(userId: string, stats: AchievementStats): Achievement[] {
    const already = new Set(achievementsService.getUnlocked(userId));
    const newlyUnlocked: Achievement[] = [];
    for (const a of ACHIEVEMENTS) {
      if (!already.has(a.id) && a.condition(stats)) {
        achievementsService.unlock(userId, a.id);
        newlyUnlocked.push(a);
      }
    }
    return newlyUnlocked;
  },

  getAll(userId: string): (Achievement & { unlocked: boolean })[] {
    const unlocked = new Set(achievementsService.getUnlocked(userId));
    return ACHIEVEMENTS.map(a => ({ ...a, unlocked: unlocked.has(a.id) }));
  },
};
