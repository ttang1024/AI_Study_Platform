import type { ActivityHeatmap } from '../services/analyticsService';

/** A GitHub-style year of activity: 53 whole weeks ending on the Saturday of the final week. */
export const HEATMAP_WEEKS = 53;

export interface HeatmapDayCell {
  date: Date;
  /** ISO yyyy-mm-dd, the key the API reports a day under. */
  key: string;
  reviews: number;
  minutes: number;
  /** Combined intensity the colour ramp reads. */
  score: number;
  /** False for the padding days outside the reported range, which render blank. */
  inRange: boolean;
}

export const heatmapDayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Lays the reported days out as columns of seven, oldest first.
 *
 * <p>Everything is computed in UTC so the grid does not shift a day when the viewer's timezone
 * differs from the one the reviews were recorded in.</p>
 */
export function buildHeatmapGrid(data: ActivityHeatmap): HeatmapDayCell[][] {
  const byDay = new Map<string, { reviews: number; minutes: number }>();
  for (const d of data.days) {
    byDay.set(d.date.slice(0, 10), { reviews: d.reviews, minutes: d.studyMinutes });
  }

  const to = new Date(data.to);
  const from = new Date(data.from);
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

  // Pad the final column out to Saturday, then walk back 53 whole weeks.
  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));
  const gridStart = new Date(gridEnd);
  gridStart.setUTCDate(gridStart.getUTCDate() - (HEATMAP_WEEKS * 7 - 1));

  const weeks: HeatmapDayCell[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const col: HeatmapDayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = heatmapDayKey(cursor);
      const activity = byDay.get(key);
      col.push({
        date: new Date(cursor),
        key,
        reviews: activity?.reviews ?? 0,
        minutes: activity?.minutes ?? 0,
        score: (activity?.reviews ?? 0) + (activity?.minutes ?? 0),
        inRange: cursor >= from && cursor <= end,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(col);
  }
  return weeks;
}
