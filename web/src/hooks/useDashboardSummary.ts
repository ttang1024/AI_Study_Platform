import { useEffect, useState } from 'react';
import { analyticsService, type DashboardSummary } from '../services/analyticsService';

interface UseDashboardSummary {
  summary: DashboardSummary | null;
  loading: boolean;
}

/**
 * Fetches the consolidated dashboard summary (streak, due flashcards, reinforcement counts)
 * in a single request. The dashboard calls this once and passes the result to the widgets that
 * need it, so they no longer each pull their own (previously heavy) data client-side.
 */
export function useDashboardSummary(): UseDashboardSummary {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    analyticsService.getDashboardSummary()
      .then(data => { if (!cancelled) setSummary(data); })
      .catch(() => { /* widgets fall back to neutral/empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { summary, loading };
}
