import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { analyticsService } from '@/services/analyticsService';

interface StudyTimerOptions {
  /** "course" | "flashcards" | "glossary" | "document" | "video" | "practice" | "general" */
  contextType: string;
  courseId?: string | null;
  contextId?: string | null;
  /** Set false to pause tracking (e.g. while data is still loading). */
  enabled?: boolean;
}

const FLUSH_INTERVAL_MS = 30_000;

/**
 * Mobile port of web's useStudyTimer: accumulates active study seconds on the
 * screen that mounts it and periodically flushes them to the analytics endpoint
 * as heartbeats. Web gates on tab visibility + recent DOM activity; here the
 * proxy is "this screen is focused AND the app is foregrounded" — a backgrounded
 * app or a navigated-away screen stops the clock, which also covers the
 * left-open-overnight case since iOS/Android suspend backgrounded JS timers.
 * Flushes on a timer, when the app leaves the foreground, and on blur/unmount.
 */
export function useStudyTimer({ contextType, courseId, contextId, enabled = true }: StudyTimerOptions) {
  const optsRef = useRef({ contextType, courseId, contextId });
  useEffect(() => {
    optsRef.current = { contextType, courseId, contextId };
  }, [contextType, courseId, contextId]);

  const accumulatedRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      const flush = () => {
        const seconds = accumulatedRef.current;
        if (seconds < 1) return;
        accumulatedRef.current = 0;
        const { contextType: ctx, courseId: cid, contextId: ctxId } = optsRef.current;
        void analyticsService
          .recordStudySession({ contextType: ctx, courseId: cid, contextId: ctxId, durationSeconds: seconds })
          .catch(() => { /* heartbeat is best-effort */ });
      };

      const tick = setInterval(() => {
        if (AppState.currentState === 'active') accumulatedRef.current += 1;
      }, 1000);
      const flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state !== 'active') flush();
      });

      return () => {
        appStateSub.remove();
        clearInterval(tick);
        clearInterval(flushTimer);
        flush();
      };
    }, [enabled]),
  );
}
