import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageVisit } from '../services/pageVisitService';

/**
 * Posts a page-view beacon whenever the route changes. Must be called inside the router — the
 * `PageVisitTracker` component in `App.tsx` is the one place that does.
 *
 * Only `pathname` is watched, and only `pathname` is sent: a query string is a filter on a page,
 * not a different page, and it is the part that carries search terms.
 */
export const usePageVisitTracking = (): void => {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageVisit(pathname);
  }, [pathname]);
};
