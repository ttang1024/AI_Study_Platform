import { useCallback, useState } from 'react';
import { AchievementStats as ServerAchievementStats, CourseMaterialStats, statsService, UserStats } from '../../services/statsService';

export const EMPTY_ACHIEVEMENT_STATS: ServerAchievementStats = {
  perfectQuizzes: 0,
  averageQuizScore: 0,
  flashcardsMastered: 0,
};

export const EMPTY_STATS: UserStats = {
  totalDocuments: 0,
  totalArticles: 0,
  totalAudio: 0,
  totalMaterials: 0,
  totalNotes: 0,
  totalFlashcards: 0,
  totalGlossaryTerms: 0,
  totalQuizQuestions: 0,
  totalQuizSubmissions: 0,
  totalVideos: 0,
  courseMaterialCounts: [],
  achievements: EMPTY_ACHIEVEMENT_STATS,
};

/**
 * The whole-library counters (dashboard tiles, "fetch all" sizing for the other slices) plus
 * achievement stats. Other slices read `documentCount`/`total*` to size their own fetches and call
 * the `setTotal*` setters here for optimistic updates (e.g. a delete decrementing a count) —
 * the raw setters are exposed rather than one combined update fn to keep those call sites terse.
 */
export function useStatsSlice() {
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [totalAudio, setTotalAudio] = useState(0);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [totalNotes, setTotalNotes] = useState(0);
  const [totalFlashcards, setTotalFlashcards] = useState(0);
  const [totalGlossaryTerms, setTotalGlossaryTerms] = useState(0);
  const [totalQuizQuestions, setTotalQuizQuestions] = useState(0);
  const [totalQuizSubmissions, setTotalQuizSubmissions] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [courseMaterialCounts, setCourseMaterialCounts] = useState<CourseMaterialStats[]>([]);
  const [achievementStats, setAchievementStats] = useState<ServerAchievementStats>(EMPTY_ACHIEVEMENT_STATS);

  const applyStats = useCallback((stats: UserStats) => {
    setTotalDocuments(stats.totalDocuments);
    setTotalArticles(stats.totalArticles);
    setTotalAudio(stats.totalAudio);
    setTotalMaterials(stats.totalMaterials);
    setTotalNotes(stats.totalNotes);
    setTotalFlashcards(stats.totalFlashcards);
    setTotalGlossaryTerms(stats.totalGlossaryTerms);
    setTotalQuizQuestions(stats.totalQuizQuestions);
    setTotalQuizSubmissions(stats.totalQuizSubmissions);
    setTotalVideos(stats.totalVideos);
    setCourseMaterialCounts(stats.courseMaterialCounts);
    setAchievementStats(stats.achievements);
  }, []);

  const refreshStats = useCallback(async (): Promise<void> => {
    try {
      applyStats(await statsService.getUserStats());
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  }, [applyStats]);

  const resetStats = useCallback(() => applyStats(EMPTY_STATS), [applyStats]);

  // documentCount must cover every row /api/documents returns (plain docs + articles + audio),
  // not just totalDocuments — otherwise the documents slice's fetch is sized too small and truncates.
  const documentCount = totalDocuments + totalArticles + totalAudio;

  return {
    totalDocuments, totalArticles, totalAudio, totalMaterials, totalNotes, totalFlashcards,
    totalGlossaryTerms, totalQuizQuestions, totalQuizSubmissions, totalVideos,
    courseMaterialCounts, achievementStats, documentCount,
    setTotalDocuments, setTotalArticles, setTotalAudio, setTotalMaterials, setTotalNotes,
    setTotalFlashcards, setTotalVideos,
    applyStats, refreshStats, resetStats,
  };
}
