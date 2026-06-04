import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Flame, Play, Layers, ArrowRight, CalendarClock, Target } from 'lucide-react';
import { todayService, type TodayPlan } from '../../services/todayService';

const ProgressBar: React.FC<{ percent: number }> = ({ percent }) => (
  <div className="h-2 w-full rounded-full bg-white/25 overflow-hidden">
    <motion.div
      className="h-full rounded-full bg-white"
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(percent, 100)}%` }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    />
  </div>
);

/**
 * The dashboard's action hub: leads with what to do right now — streak, today's goal progress,
 * cards due, and the single highest-priority focus task — rather than just links. Pulls the same
 * composed "Today" plan that powers /today.
 */
export const TodayActionHub: React.FC = () => {
  const [plan, setPlan] = useState<TodayPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    todayService.getTodayPlan()
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || !plan) return null;

  const topFocus = plan.items.find(i => !i.stretch) ?? plan.items[0] ?? null;
  const headline = plan.dueFlashcards > 0
    ? `${plan.dueFlashcards} card${plan.dueFlashcards === 1 ? '' : 's'} due for review`
    : topFocus
      ? topFocus.title
      : 'You’re all caught up — add material or revisit a course';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative overflow-hidden rounded-3xl p-6 text-white"
      style={{ background: 'linear-gradient(120deg, #0f766e 0%, #0d9488 45%, #0891b2 100%)' }}
    >
      <Target size={150} strokeWidth={1} className="pointer-events-none absolute -right-6 -top-8 opacity-[0.12]" />

      <div className="relative z-10">
        {/* Streak + progress */}
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
            <Flame size={16} className={plan.streak.currentStreak > 0 ? 'text-orange-200' : 'text-white/50'} />
            {plan.streak.currentStreak > 0 ? `${plan.streak.currentStreak}-day streak` : 'Start a streak today'}
          </span>
          <span className="text-white/70 text-[12px]">·</span>
          <span className="text-[12px] text-white/80 tabular-nums">{plan.todayMinutes}/{plan.dailyGoalMinutes} min today</span>
        </div>

        <h2 className="text-[22px] sm:text-[26px] font-bold leading-tight tracking-tight mt-1">{headline}</h2>

        {topFocus && (
          <p className="text-[13px] text-white/80 mt-1.5 flex items-center gap-1.5">
            <CalendarClock size={13} /> Next up: {topFocus.subtitle} · ~{topFocus.estimatedMinutes} min
          </p>
        )}

        <div className="mt-4 mb-5"><ProgressBar percent={plan.completionPercent} /></div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/today"
            className="inline-flex items-center gap-2 rounded-xl bg-white text-[var(--primary)] px-4 py-2.5 text-[14px] font-bold hover:bg-white/90 transition-colors"
          >
            <Play size={15} /> Start today’s plan
          </Link>
          <Link
            to="/practice"
            className="inline-flex items-center gap-2 rounded-xl bg-white/15 text-white px-4 py-2.5 text-[14px] font-bold hover:bg-white/25 transition-colors backdrop-blur"
          >
            <Layers size={15} /> Practice test
          </Link>
          {plan.dueFlashcards > 0 && (
            <Link
              to="/flashcards"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/85 hover:text-white transition-colors"
            >
              Review cards <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};
