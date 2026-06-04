import { apiClient } from './apiClient';
import type { StudyStreak } from './analyticsService';

export type TodayPlanItemType =
  | 'flashcards' | 'quiz' | 'glossary' | 'problems' | 'gap' | 'course' | 'material';

export interface TodayPlanItem {
  id: string;
  type: TodayPlanItemType;
  title: string;
  subtitle: string;
  priority: number;
  estimatedMinutes: number;
  url: string | null;
  count: number | null;
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

export const todayService = {
  async getTodayPlan(): Promise<TodayPlan> {
    const response = await apiClient.get('/api/recommendations/today');
    return response.data.data;
  },
};
