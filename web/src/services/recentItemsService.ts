/**
 * Recency history for the command palette. Deliberately client-only and scoped to
 * "things opened through the palette itself" (not a general page-view tracker across
 * the whole app) — the same behavior Spotlight/VS Code Quick Open give you, and it
 * needs no plumbing through every detail page to work.
 */
export interface RecentItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'document' | 'flashcard' | 'note' | 'glossary' | 'quiz' | 'chat';
  href: string;
  openedAt: number;
}

const STORAGE_KEY = 'sp_recent_items';
const MAX_ITEMS = 8;

const read = (): RecentItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getRecentItems = (): RecentItem[] => read();

export const recordRecentItem = (item: Omit<RecentItem, 'openedAt'>): void => {
  const deduped = read().filter(r => !(r.id === item.id && r.type === item.type));
  deduped.unshift({ ...item, openedAt: Date.now() });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped.slice(0, MAX_ITEMS)));
  } catch {
    // Storage full or unavailable (private browsing) — recency history is a nicety, not critical.
  }
};

export const clearRecentItems = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
};
