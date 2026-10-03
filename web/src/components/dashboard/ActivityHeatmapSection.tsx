import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { analyticsService, type ActivityHeatmap } from '../../services/analyticsService';
import { ChartCard, EmptyState, PRIMARY } from './dashboardChrome';
import { buildHeatmapGrid, HEATMAP_WEEKS } from '@core/utils/heatmapGrid';

const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;
const PAD_LEFT = 28; // weekday labels
const PAD_TOP = 16; // month labels

/** Opacity ramp for activity levels 1–4 (level 0 renders the empty-cell fill). */
const LEVEL_OPACITY = [0, 0.25, 0.45, 0.7, 1];

export const ActivityHeatmapSection: React.FC = () => {
  const [data, setData] = useState<ActivityHeatmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ w: number; d: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    analyticsService.getActivityHeatmap()
      .then(d => { if (!cancelled) setData(Array.isArray(d?.days) ? d : null); })
      .catch(() => { /* leave empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const weeks = useMemo(() => (data ? buildHeatmapGrid(data) : []), [data]);

  // Quartile thresholds over the non-zero scores decide the four intensity levels,
  // so a light-study user and a heavy one both get a full-range heatmap.
  const level = useMemo(() => {
    const scores = weeks.flat().filter(c => c.score > 0).map(c => c.score).sort((a, b) => a - b);
    if (scores.length === 0) return () => 0;
    const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];
    const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
    return (score: number) => (score === 0 ? 0 : score <= q1 ? 1 : score <= q2 ? 2 : score <= q3 ? 3 : 4);
  }, [weeks]);

  const monthLabels = useMemo(() => {
    const labels: { w: number; text: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((col, w) => {
      const m = col[0].date.getUTCMonth();
      if (m !== lastMonth) {
        // Skip a label squeezed into the very first column when the next one is close behind.
        if (labels.length === 0 || w - labels[labels.length - 1].w >= 3) {
          labels.push({ w, text: col[0].date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }) });
        }
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  const W = PAD_LEFT + HEATMAP_WEEKS * STEP;
  const H = PAD_TOP + 7 * STEP;

  const hoveredCell = hover ? weeks[hover.w]?.[hover.d] : null;

  return (
    <ChartCard
      title="Study activity"
      meta={data && (
        <p className="text-[11px] text-text-muted tabular-nums">
          {data.totalReviews} reviews · {Math.round(data.totalStudyMinutes / 60)}h studied · {data.activeDays} active days
        </p>
      )}
    >
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="animate-spin text-zinc-300" />
        </div>
      ) : !data || data.activeDays === 0 ? (
        <EmptyState widthCh={44}>
          A year-at-a-glance map of your studying will grow here — every review session and study minute paints a square.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="min-w-[640px] w-full"
            role="img"
            aria-label="Daily study activity over the past year"
            onMouseLeave={() => setHover(null)}
          >
            {monthLabels.map(m => (
              <text key={`${m.text}-${m.w}`} x={PAD_LEFT + m.w * STEP} y={10} fontSize="9" fill="var(--text-muted)">{m.text}</text>
            ))}
            {[{ d: 1, t: 'Mon' }, { d: 3, t: 'Wed' }, { d: 5, t: 'Fri' }].map(l => (
              <text key={l.t} x={PAD_LEFT - 5} y={PAD_TOP + l.d * STEP + CELL - 2} textAnchor="end" fontSize="8" fill="var(--text-muted)">{l.t}</text>
            ))}

            {weeks.map((col, w) => col.map((cell, d) => {
              if (!cell.inRange) return null;
              const lv = level(cell.score);
              return (
                <rect
                  key={cell.key}
                  x={PAD_LEFT + w * STEP}
                  y={PAD_TOP + d * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={lv === 0 ? undefined : PRIMARY}
                  fillOpacity={lv === 0 ? undefined : LEVEL_OPACITY[lv]}
                  className={lv === 0 ? 'fill-zinc-100 dark:fill-zinc-700' : undefined}
                  onMouseEnter={() => setHover({ w, d })}
                />
              );
            }))}

            {hoveredCell && hover && (
              <g pointerEvents="none">
                <rect
                  x={PAD_LEFT + hover.w * STEP - 1.5}
                  y={PAD_TOP + hover.d * STEP - 1.5}
                  width={CELL + 3}
                  height={CELL + 3}
                  rx={3.5}
                  fill="none"
                  stroke="var(--text-main)"
                  strokeWidth="1.25"
                />
                <text
                  x={Math.min(Math.max(PAD_LEFT + hover.w * STEP, 110), W - 110)}
                  y={hover.d < 2 ? PAD_TOP + (hover.d + 1) * STEP + 12 : PAD_TOP + hover.d * STEP - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--text-main)"
                >
                  {hoveredCell.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  {' · '}{hoveredCell.reviews} reviews · {hoveredCell.minutes} min
                </text>
              </g>
            )}
          </svg>

          <div className="flex items-center justify-end gap-1 mt-1 pr-1">
            <span className="text-[10px] text-text-muted mr-1">Less</span>
            {LEVEL_OPACITY.map((o, i) => (
              <svg key={i} width={CELL} height={CELL} aria-hidden>
                <rect
                  width={CELL} height={CELL} rx={2.5}
                  fill={i === 0 ? undefined : PRIMARY}
                  fillOpacity={i === 0 ? undefined : o}
                  className={i === 0 ? 'fill-zinc-100 dark:fill-zinc-700' : undefined}
                />
              </svg>
            ))}
            <span className="text-[10px] text-text-muted ml-1">More</span>
          </div>
        </div>
      )}
    </ChartCard>
  );
};
