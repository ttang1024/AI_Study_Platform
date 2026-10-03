import { useEffect, useRef } from 'react';
import { analyticsService } from '../services/analyticsService';

interface StudyTimerOptions {
  /** "course" | "flashcards" | "glossary" | "document" | "video" | "quiz" | "general" */
  contextType: string;
  courseId?: string | null;
  contextId?: string | null;
  /** Set false to pause tracking (e.g. while data is still loading). */
  enabled?: boolean;
}

// Count time only while the tab is visible AND the user has interacted recently,
// so leaving a tab open overnight doesn't inflate "time on task".
const IDLE_LIMIT_MS = 60_000;
const FLUSH_INTERVAL_MS = 30_000;

/**
 * Accumulates active study seconds on the surface that mounts it and periodically
 * flushes them to the analytics endpoint as heartbeats. Flushes on a timer, when the
 * tab is hidden, and on unmount so partial sessions aren't lost.
 */
export function useStudyTimer({ contextType, courseId, contextId, enabled = true }: StudyTimerOptions) {
  const optsRef = useRef({ contextType, courseId, contextId });
  optsRef.current = { contextType, courseId, contextId };

  const accumulatedRef = useRef(0);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const markActivity = () => { lastActivityRef.current = Date.now(); };
    const activityEvents: (keyof DocumentEventMap)[] = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    activityEvents.forEach(e => document.addEventListener(e, markActivity, { passive: true }));

    const flush = () => {
      const seconds = accumulatedRef.current;
      if (seconds < 1) return;
      accumulatedRef.current = 0;
      const { contextType: ctx, courseId: cid, contextId: ctxId } = optsRef.current;
      void analyticsService
        .recordStudySession({ contextType: ctx, courseId: cid, contextId: ctxId, durationSeconds: seconds })
        .catch(() => { /* heartbeat is best-effort */ });
    };

    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastActivityRef.current > IDLE_LIMIT_MS) return;
      accumulatedRef.current += 1;
    }, 1000);

    const flushTimer = window.setInterval(flush, FLUSH_INTERVAL_MS);

    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    return () => {
      activityEvents.forEach(e => document.removeEventListener(e, markActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.clearInterval(tick);
      window.clearInterval(flushTimer);
      flush();
    };
  }, [enabled]);
}
