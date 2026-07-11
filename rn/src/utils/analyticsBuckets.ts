// Ports web's day-vs-week bucketing from AnalyticsSection.tsx: 7/30-day ranges show one bar per
// day; the 90-day range collapses into ~13 weekly bars instead of 90 cramped daily ones.

export interface ChartBucket {
  label: string;
  value: number;
}

const startOfDay = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const dateKey = (d: Date): string => startOfDay(d).toISOString().slice(0, 10);

const shortLabel = (d: Date): string => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// `days` consecutive dates ending today, oldest first.
const windowDays = (days: number): Date[] => {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return d;
  });
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export const bucketMinutes = (daily: { date: string; totalMinutes: number }[], days: number): ChartBucket[] => {
  const byDate = new Map(daily.map((d) => [dateKey(new Date(d.date)), d.totalMinutes]));
  const dates = windowDays(days);
  const minutes = dates.map((d) => byDate.get(dateKey(d)) ?? 0);

  if (days <= 31) {
    return dates.map((d, i) => ({ label: shortLabel(d), value: minutes[i] }));
  }
  return chunk(dates, 7).map((weekDates, i) => ({
    label: shortLabel(weekDates[0]),
    value: chunk(minutes, 7)[i].reduce((sum, m) => sum + m, 0),
  }));
};

export const bucketAccuracy = (
  daily: { date: string; totalAttempts: number; correctAttempts: number }[],
  days: number,
): ChartBucket[] => {
  const byDate = new Map(daily.map((d) => [dateKey(new Date(d.date)), d]));
  const dates = windowDays(days);
  const points = dates.map((d) => byDate.get(dateKey(d)) ?? { totalAttempts: 0, correctAttempts: 0 });

  // Attempt-weighted: sum correct/total across the bucket, then take the ratio — not an
  // average of daily percentages, which would over-weight low-volume days.
  const accuracyOf = (items: { totalAttempts: number; correctAttempts: number }[]): number => {
    const total = items.reduce((sum, p) => sum + p.totalAttempts, 0);
    if (total === 0) return 0;
    const correct = items.reduce((sum, p) => sum + p.correctAttempts, 0);
    return Math.round((correct / total) * 100);
  };

  if (days <= 31) {
    return dates.map((d, i) => ({ label: shortLabel(d), value: accuracyOf([points[i]]) }));
  }
  return chunk(dates, 7).map((weekDates, i) => ({
    label: shortLabel(weekDates[0]),
    value: accuracyOf(chunk(points, 7)[i]),
  }));
};
