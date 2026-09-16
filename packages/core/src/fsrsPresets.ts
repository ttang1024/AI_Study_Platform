/**
 * The scheduler-settings presets offered by both apps' FSRS tuning screen
 * (web SchedulerTab, rn settings/scheduler). They are product copy as much as
 * data — the two screens must offer the same choices under the same wording —
 * so they live here rather than being kept in sync by hand.
 */

/** Phrased as the trade-off the learner is actually making, not as a probability. */
export const RETENTION_PRESETS = [
  { value: 0.85, label: 'Relaxed', hint: 'Fewer reviews, more forgetting' },
  { value: 0.9, label: 'Balanced', hint: 'The FSRS default' },
  { value: 0.95, label: 'Thorough', hint: 'More reviews, less forgetting' },
] as const;

export const MAX_INTERVAL_PRESETS = [
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
  { value: 1825, label: '5 years' },
  { value: 36500, label: 'No limit' },
] as const;

/** 0 means "no new cards today", not "unlimited". */
export const NEW_PER_DAY_PRESETS = [0, 5, 10, 20, 40] as const;

/** Trailing 0 means "no ceiling" — the opposite of the new-cards 0. */
export const REVIEWS_PER_DAY_PRESETS = [50, 100, 200, 0] as const;

/** Day counts a review backlog can be spread across. */
export const BACKLOG_SPREADS = [3, 7, 14] as const;
