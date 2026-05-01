import { useEffect, useRef, useCallback } from 'react';

interface ScrollProgressData {
  scrollTop: number;
  percentage: number;
  timestamp: string;
}

const key = (userId: string, documentId: string) => `scroll_${userId}_${documentId}`;

export function useScrollProgress(
  userId: string,
  documentId: string,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveProgress = useCallback((scrollTop: number, height: number, scrollHeight: number) => {
    if (!documentId || !userId) return;
    const percentage = scrollHeight > height
      ? Math.round((scrollTop / (scrollHeight - height)) * 100)
      : 100;
    const data: ScrollProgressData = {
      scrollTop,
      percentage,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(key(userId, documentId), JSON.stringify(data));
  }, [userId, documentId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        saveProgress(el.scrollTop, el.clientHeight, el.scrollHeight);
      }, 1500);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [containerRef, saveProgress]);

  const getSavedProgress = useCallback((): ScrollProgressData | null => {
    try {
      const raw = localStorage.getItem(key(userId, documentId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [userId, documentId]);

  const restoreProgress = useCallback(() => {
    const saved = getSavedProgress();
    const el = containerRef.current;
    if (!saved || !el) return;
    requestAnimationFrame(() => {
      el.scrollTop = saved.scrollTop;
    });
  }, [containerRef, getSavedProgress]);

  const clearProgress = useCallback(() => {
    localStorage.removeItem(key(userId, documentId));
  }, [userId, documentId]);

  return { getSavedProgress, restoreProgress, clearProgress };
}
