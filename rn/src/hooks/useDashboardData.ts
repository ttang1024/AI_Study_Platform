import { useCallback, useEffect, useState } from 'react';

import { analyticsService } from '@/services/analyticsService';
import { recommendationService } from '@/services/recommendationService';
import { syncWidgetData } from '@/services/widgetBridge';
import type { DashboardSummary, TodayPlan } from '@/types';

export interface DashboardData {
  today: TodayPlan;
  summary: DashboardSummary;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // `isRefresh` stays internal. There are only two ways in — the mount load and a user-initiated
  // refresh — and exposing the flag invited a `reload(false)` that would show no spinner at all,
  // since `loading` is only ever true before the first load resolves.
  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [today, summary] = await Promise.all([
        recommendationService.getTodayPlan(),
        analyticsService.getDashboardSummary(),
      ]);
      setData({ today, summary });
      syncWidgetData(summary);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load(false);
    })();
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { data, loading, refreshing, refresh };
}
