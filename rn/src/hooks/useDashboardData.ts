import { useCallback, useEffect, useState } from 'react';

import { analyticsService } from '@/services/analyticsService';
import { notificationService } from '@/services/notificationService';
import { recommendationService, type RecommendationItem } from '@/services/recommendationService';
import { statsService } from '@/services/statsService';
import { syncWidgetData } from '@/services/widgetBridge';
import type { DashboardSummary, TodayPlan, UserStats, UserXp, WeeklyDigest } from '@/types';

export interface DashboardData {
  today: TodayPlan;
  summary: DashboardSummary;
  stats: UserStats;
  xp: UserXp;
  digest: WeeklyDigest;
  nextBestContent: RecommendationItem[];
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [today, summary, stats, xp, digest, recommendations] = await Promise.all([
        recommendationService.getTodayPlan(),
        analyticsService.getDashboardSummary(),
        statsService.getUserStats(),
        statsService.getXp(),
        notificationService.getWeeklyDigest(),
        recommendationService.getRecommendations(),
      ]);
      setData({ today, summary, stats, xp, digest, nextBestContent: recommendations.nextBestContent });
      syncWidgetData(summary);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { data, loading, refreshing, reload: load };
}
