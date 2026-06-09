// Shared helpers for the "Today" plan surfaces (hero on the dashboard, plan
// list under the Insights → Analytics tab). Completions are tracked locally,
// keyed by date, so the hero and the list stay consistent.
export const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';

export const doneStorageKey = (date: string) => `today-plan-done:${date}`;
export const todayKey = () => new Date().toISOString().slice(0, 10);

export const loadDone = (): Set<string> => {
  try {
    const raw = localStorage.getItem(doneStorageKey(todayKey()));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
};

export const persistDone = (done: Set<string>) => {
  try {
    localStorage.setItem(doneStorageKey(todayKey()), JSON.stringify([...done]));
  } catch { /* ignore corrupt / unavailable storage */ }
};
