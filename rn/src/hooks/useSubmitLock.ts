import { useCallback, useRef } from 'react';

/**
 * Runs an async submit handler at most once at a time.
 *
 * The forms already pass `loading` to Button, which disables it — but that state only lands on the
 * next render. Two fingers touching the same button within one frame both read the old value and
 * both fire, which is how a single "tap" can produce two uploads. A ref flips synchronously, so the
 * second press is dropped before it does any work.
 */
export function useSubmitLock(): (run: () => Promise<unknown>) => void {
  const busy = useRef(false);

  return useCallback((run: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    void Promise.resolve()
      .then(run)
      .finally(() => { busy.current = false; });
  }, []);
}
