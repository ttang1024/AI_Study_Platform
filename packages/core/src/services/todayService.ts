import type { HttpClient } from '../http';
import type { StudyStreak } from './analyticsService';

/**
 * The "Today" plan — the streak/goal header plus one ranked, time-budgeted list that stitches the
 * recommendation queue and the top knowledge gaps into a single place to start studying.
 *
 * Shapes mirror `TodayPlanDto` / `TodayPlanItemDto` on the server. `url` and `count` really are
 * nullable there, so they are nullable here: `url` is a *web* route, and clients with their own
 * route tree (rn) map on `type` instead of parsing it.
 */
export type TodayPlanItemType =
  | 'flashcards'
  | 'quiz'
  | 'glossary'
  | 'problems'
  | 'gap'
  | 'course'
  | 'material';

export interface TodayPlanItem {
  id: string;
  type: TodayPlanItemType;
  title: string;
  subtitle: string;
  priority: number;
  estimatedMinutes: number;
  url: string | null;
  count: number | null;
  /** Beyond today's goal budget — still worth doing, shown as an optional extra. */
  stretch: boolean;
}

export interface TodayPlan {
  streak: StudyStreak;
  dailyGoalMinutes: number;
  todayMinutes: number;
  completionPercent: number;
  goalMet: boolean;
  plannedMinutes: number;
  dueFlashcards: number;
  items: TodayPlanItem[];
  generatedAt: string;
}

export function createTodayService(http: HttpClient) {
  return {
    async getTodayPlan(): Promise<TodayPlan> {
      const res = await http.get<{ data: TodayPlan }>('/api/recommendations/today');
      return res.data.data;
    },
  };
}

export type TodayService = ReturnType<typeof createTodayService>;
