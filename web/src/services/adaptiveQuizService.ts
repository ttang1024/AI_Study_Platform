import { AdaptiveQuizProfile } from '../types';

const KEY = (userId: string, docId: string) => `adaptive_quiz_${userId}_${docId}`;

export const adaptiveQuizService = {
  getProfile(userId: string, docId: string): AdaptiveQuizProfile {
    try {
      const raw = localStorage.getItem(KEY(userId, docId));
      return raw ? JSON.parse(raw) : {
        documentId: docId,
        recentScores: [],
        weakTopicKeywords: [],
        difficultyLevel: 'medium',
      };
    } catch {
      return { documentId: docId, recentScores: [], weakTopicKeywords: [], difficultyLevel: 'medium' };
    }
  },

  recordResult(
    userId: string,
    docId: string,
    score: number,
    total: number,
  ): AdaptiveQuizProfile {
    const profile = this.getProfile(userId, docId);
    const percentage = total > 0 ? score / total : 0;
    profile.recentScores = [...profile.recentScores.slice(-9), percentage];

    const avgScore = profile.recentScores.reduce((a, b) => a + b, 0) / profile.recentScores.length;
    if (avgScore >= 0.85) profile.difficultyLevel = 'hard';
    else if (avgScore >= 0.60) profile.difficultyLevel = 'medium';
    else profile.difficultyLevel = 'easy';

    localStorage.setItem(KEY(userId, docId), JSON.stringify(profile));
    return profile;
  },

  getDifficultyLabel(profile: AdaptiveQuizProfile): string {
    const map = { easy: 'Beginner', medium: 'Intermediate', hard: 'Advanced' };
    return map[profile.difficultyLevel];
  },

  getAverageScore(profile: AdaptiveQuizProfile): number {
    if (profile.recentScores.length === 0) return 0;
    return Math.round((profile.recentScores.reduce((a, b) => a + b, 0) / profile.recentScores.length) * 100);
  },
};
