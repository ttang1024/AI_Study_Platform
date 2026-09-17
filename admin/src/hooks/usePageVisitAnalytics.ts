import { useEffect, useState } from 'react';
import { adminApi } from '../services/api';
import type { PageVisitAnalytics } from '../types';

/** Windows the dashboard offers. Anything longer is a report, not a glance. */
export const VISIT_WINDOWS = [7, 30, 90] as const;

export type VisitWindow = (typeof VISIT_WINDOWS)[number];

/**
 * Loads page-view analytics for a trailing window, refetching when the window changes.
 *
 * Separate from the platform-analytics call on purpose: this one reads the table that grows with
 * traffic, so it is the query an admin may want narrower — and the one that should not delay the
 * rest of the dashboard while it runs.
 */
export function usePageVisitAnalytics(initialDays: VisitWindow = 30) {
  const [days, setDays] = useState<VisitWindow>(initialDays);
  const [data, setData] = useState<PageVisitAnalytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');

    adminApi.getPageVisitAnalytics(days)
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setError('Failed to load page visits.'); });

    return () => { cancelled = true; };
  }, [days]);

  return { data, error, days, setDays };
}
