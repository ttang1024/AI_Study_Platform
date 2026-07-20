import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';
import { achievementsService, Achievement, AchievementProgress } from '../../services/achievementsService';
import { useAuth } from '../../context/AuthContext';
import { useStudy } from '../../context/StudyContext';
import { cn } from '../../utils/cn';

const CATEGORY_COLORS: Record<string, string> = {
  flashcards: '#059669',
  quizzes: '#10b981',
  notes: '#f59e0b',
  documents: '#14b8a6',
};

export const AchievementsPanel: React.FC = () => {
  const { user } = useAuth();
  const { totalFlashcards, totalNotes, totalDocuments, totalQuizSubmissions, achievementStats } = useStudy();
  const userId = user?.id ?? 'guest';

  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);

  const stats = useMemo<AchievementProgress>(() => {
    return {
      totalFlashcards,
      totalQuizSubmissions,
      totalNotes,
      totalDocuments,
      achievements: achievementStats,
    };
  }, [achievementStats, totalFlashcards, totalNotes, totalDocuments, totalQuizSubmissions]);

  useEffect(() => {
    const newly = achievementsService.checkAndUnlock(userId, stats);
    if (newly.length > 0) setNewlyUnlocked(newly);
  }, [stats, userId]);

  useEffect(() => {
    if (newlyUnlocked.length > 0) {
      const t = setTimeout(() => setNewlyUnlocked([]), 4000);
      return () => clearTimeout(t);
    }
  }, [newlyUnlocked]);

  const allAchievements = achievementsService.getAll(userId);
  const unlockedCount = allAchievements.filter(a => a.unlocked).length;

  return (
    <div className="space-y-4">
      {/* New unlock toast */}
      <AnimatePresence>
        {newlyUnlocked.map(a => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg"
          >
            <span className="text-2xl">{a.icon}</span>
            <div>
              <p className="text-sm font-black text-amber-800">Achievement Unlocked!</p>
              <p className="text-xs text-amber-700">{a.title} — {a.description}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted">{unlockedCount} / {allAchievements.length} unlocked</span>
        <div className="h-2 w-32 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all"
            style={{ width: `${(unlockedCount / allAchievements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {allAchievements.map(a => (
          <div
            key={a.id}
            className={cn(
              'relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all',
              a.unlocked
                ? 'border-amber-200 bg-amber-50/50 shadow-sm'
                : 'border-[var(--border-color)] bg-[var(--bg-sidebar)] opacity-50 grayscale',
            )}
          >
            <span className="text-3xl">{a.icon}</span>
            <div>
              <p className={cn('text-xs font-black', a.unlocked ? 'text-text-main' : 'text-text-muted')}>{a.title}</p>
              <p className="text-[10px] text-text-muted leading-tight mt-0.5">{a.description}</p>
            </div>
            {a.unlocked && (
              <div
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[a.category] }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
