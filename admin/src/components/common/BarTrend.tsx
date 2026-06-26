import React from 'react';
import { cn } from '../../utils/cn';
import { formatDay } from '../../utils/format';
import type { DailyCount } from '../../types';

interface BarTrendProps {
  title: string;
  data: DailyCount[];
  /** Tailwind background class for the bars. */
  barClass?: string;
  /** Format a data point's value for the tooltip / footer (defaults to the raw number). */
  formatValue?: (value: number) => string;
  /** Optional caption rendered under the title (e.g. a total). */
  subtitle?: string;
}

/**
 * Lightweight, dependency-free bar chart for daily trend data. Bars are flexbox
 * columns scaled against the window's max, so it stays responsive without measuring
 * the container. Hovering a bar surfaces its date + value via the native title.
 */
export const BarTrend: React.FC<BarTrendProps> = ({
  title,
  data,
  barClass = 'bg-emerald-500',
  formatValue = (v) => String(v),
  subtitle,
}) => {
  const max = Math.max(1, ...data.map((d) => d.count));
  const hasAny = data.some((d) => d.count > 0);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {subtitle && <span className="text-xs text-[var(--text-secondary)]">{subtitle}</span>}
      </div>

      <div className="flex h-36 items-end gap-1">
        {data.map((d) => {
          const heightPct = hasAny ? Math.max(2, (d.count / max) * 100) : 2;
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              title={`${formatDay(d.date)} · ${formatValue(d.count)}`}
            >
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all',
                  d.count > 0 ? barClass : 'bg-black/5',
                  'group-hover:opacity-80',
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Sparse axis: first / middle / last day */}
      <div className="mt-2 flex justify-between text-[10px] text-[var(--text-secondary)]">
        <span>{data.length > 0 ? formatDay(data[0].date) : ''}</span>
        <span>{data.length > 2 ? formatDay(data[Math.floor(data.length / 2)].date) : ''}</span>
        <span>{data.length > 1 ? formatDay(data[data.length - 1].date) : ''}</span>
      </div>
    </div>
  );
};
