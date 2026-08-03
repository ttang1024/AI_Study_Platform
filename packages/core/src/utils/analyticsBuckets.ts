/**
 * Continuous-window bucketing for the study-activity and quiz-accuracy charts.
 *
 * Windows of ≤31 days get one bucket per day; longer windows collapse into weekly buckets so a
 * 90-day range doesn't render 90 cramped bars. Buckets are built from the calendar, not from the
 * rows, so a stretch with no study activity reads as a gap instead of vanishing and compressing
 * the time axis.
 *
 * Day keys are matched on the raw `YYYY-MM-DD` prefix of the API's date string, never through
 * `new Date(iso)`. Parsing a midnight-UTC date and then taking its *local* day shifts it onto the
 * previous day anywhere west of UTC, which silently misfiles a day's work.
 */

const DAILY_MAX_DAYS = 31;

const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, n: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

/** "8/2" — compact enough that a 31-bar axis still fits. */
export const numericDayLabel = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}`;

/** "Aug 2" — for axes with room, and locale-aware. */
export const shortDayLabel = (d: Date): string =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export interface WindowBucket<T> {
  /** Stable react key: the day key of the bucket's last day. */
  key: string;
  label: string;
  /** Rows falling in this bucket, in no particular order. Empty for a quiet day/week. */
  items: T[];
}

export interface BucketOptions<T> {
  /** Pulls the API date string off a row. Only its `YYYY-MM-DD` prefix is read. */
  dateOf: (row: T) => string;
  /** How many days back from today the window covers. */
  days: number;
  /** Defaults to {@link numericDayLabel}. Weekly buckets are labelled by their first day. */
  labelOf?: (d: Date) => string;
  /** Injectable for tests; defaults to now. */
  today?: Date;
}

/**
 * Groups `rows` into the buckets of a `days`-long window ending today, oldest first.
 * Rows outside the window are dropped; days with no rows still get an empty bucket.
 */
export function bucketByWindow<T>(rows: readonly T[], options: BucketOptions<T>): WindowBucket<T>[] {
  const { dateOf, days, labelOf = numericDayLabel, today = new Date() } = options;

  const byDay = new Map<string, T[]>();
  for (const row of rows) {
    const key = dateOf(row).slice(0, 10);
    const existing = byDay.get(key);
    if (existing) existing.push(row);
    else byDay.set(key, [row]);
  }

  const out: WindowBucket<T>[] = [];

  if (days > DAILY_MAX_DAYS) {
    const weeks = Math.ceil(days / 7);
    for (let w = weeks - 1; w >= 0; w--) {
      const end = addDays(today, -w * 7);
      const items: T[] = [];
      for (let i = 0; i < 7; i++) items.push(...(byDay.get(dayKey(addDays(end, -i))) ?? []));
      out.push({ key: dayKey(end), label: labelOf(addDays(end, -6)), items });
    }
    return out;
  }

  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    out.push({ key: dayKey(d), label: labelOf(d), items: byDay.get(dayKey(d)) ?? [] });
  }
  return out;
}

// ── Ready-made reductions ───────────────────────────────────────────────────

export interface ChartBucket {
  key: string;
  label: string;
  value: number;
}

/** Total minutes per bucket. */
export function bucketMinutes(
  daily: readonly { date: string; totalMinutes: number }[],
  days: number,
  labelOf?: (d: Date) => string,
): ChartBucket[] {
  return bucketByWindow(daily, { dateOf: (d) => d.date, days, labelOf }).map((b) => ({
    key: b.key,
    label: b.label,
    value: b.items.reduce((sum, d) => sum + d.totalMinutes, 0),
  }));
}

/**
 * Accuracy percentage per bucket, attempt-weighted: total correct over total attempts across the
 * bucket. Averaging the daily percentages instead would let a 1-question day outweigh a 40-question
 * one. Buckets with no attempts report 0.
 */
export function bucketAccuracy(
  daily: readonly { date: string; totalAttempts: number; correctAttempts: number }[],
  days: number,
  labelOf?: (d: Date) => string,
): ChartBucket[] {
  return bucketByWindow(daily, { dateOf: (d) => d.date, days, labelOf }).map((b) => {
    const total = b.items.reduce((sum, d) => sum + d.totalAttempts, 0);
    const correct = b.items.reduce((sum, d) => sum + d.correctAttempts, 0);
    return {
      key: b.key,
      label: b.label,
      value: total === 0 ? 0 : Math.round((correct / total) * 100),
    };
  });
}
