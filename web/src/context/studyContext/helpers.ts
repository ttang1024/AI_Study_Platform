// "Fetch all" pages have no real page boundary — we want the whole set in one
// request. Sizing by the known total (from stats) avoids both truncation when
// the user has more than a fixed cap and over-fetching when they have few.
// The floor keeps the first request useful before/if stats are unavailable.
const FETCH_ALL_FLOOR = 50;
export const fetchAllSize = (total: number) => Math.max(total, FETCH_ALL_FLOOR);
