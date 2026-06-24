// Visibility preference for the floating Pomodoro timer. Persisted in
// localStorage and broadcast via a window event so the timer (mounted at the
// app root) and the Settings page stay in sync without prop drilling.

const ENABLED_KEY = 'pomodoro-enabled';
const EVENT_NAME = 'pomodoro:enabled-changed';

export const pomodoroSettings = {
  /** Timer is shown unless the user has explicitly closed it. */
  isEnabled(): boolean {
    return localStorage.getItem(ENABLED_KEY) !== 'false';
  },

  setEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent<boolean>(EVENT_NAME, { detail: enabled }));
  },

  /** Subscribe to enable/disable changes (same tab). Returns an unsubscribe fn. */
  subscribe(cb: (enabled: boolean) => void): () => void {
    const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  },
};
