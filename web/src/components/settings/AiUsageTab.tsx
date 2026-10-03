import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Info, Zap } from 'lucide-react';
import { analyticsService, type AiUsage, type AiUsageGroup } from '../../services/analyticsService';
import { cn } from '../../utils/cn';

const RANGES = [
  { id: 7, label: '7 days' },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
] as const;

/** Warn once the day's spend is this far into the limit. */
const QUOTA_WARN_FRACTION = 0.8;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

const compactTokens = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const fullTokens = new Intl.NumberFormat();

/**
 * Costs here are estimates, and rounding them to cents would report a real $0.004 call as "$0.00".
 * Show enough precision that small spend is still visible as spend.
 */
function formatUsd(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return `<$0.01`;
  return `$${value.toFixed(2)}`;
}

/** Operations arrive as "quiz:text" / "chat:document" — readable, but not prose. */
function humanizeOperation(key: string): string {
  const [feature, variant] = key.split(':');
  const label = feature.replace(/[-_]/g, ' ');
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  return variant ? `${pretty} (${variant})` : pretty;
}

const BreakdownTable: React.FC<{
  title: string;
  caption: string;
  rows: AiUsageGroup[];
  formatKey?: (key: string) => string;
}> = ({ title, caption, rows, formatKey }) => {
  // Bars are relative to the biggest row, so the smallest spend stays visible instead of
  // collapsing to a sliver against a total.
  const max = Math.max(...rows.map(r => r.estimatedCostUsd), 0);

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-text-main">{title}</h4>
        <p className="text-xs text-text-muted mt-0.5">{caption}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted italic">No calls in this range.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="font-medium text-text-main truncate">
                  {formatKey ? formatKey(row.key) : row.key}
                </span>
                <span className="text-text-muted whitespace-nowrap tabular-nums">
                  {formatUsd(row.estimatedCostUsd)}
                  <span className="mx-1.5 opacity-40">·</span>
                  {compactTokens.format(row.totalTokens)} tok
                  <span className="mx-1.5 opacity-40">·</span>
                  {row.calls} {row.calls === 1 ? 'call' : 'calls'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: max > 0 ? `${Math.max((row.estimatedCostUsd / max) * 100, 2)}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AiUsageTab: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (rangeDays: number) => {
    setLoading(true);
    setError(null);
    try {
      setUsage(await analyticsService.getAiUsage(isoDaysAgo(rangeDays)));
    } catch {
      setError('Could not load usage.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  const quota = useMemo(() => {
    if (!usage || usage.dailyTokenLimit <= 0) return null;
    const fraction = Math.min(usage.tokensUsedToday / usage.dailyTokenLimit, 1);
    return { fraction, nearLimit: fraction >= QUOTA_WARN_FRACTION };
  }, [usage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-text-main">AI Usage</h3>
          <p className="text-sm text-text-muted mt-1">
            What your AI calls have cost, by feature and model.
          </p>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
          {RANGES.map(range => (
            <button
              key={range.id}
              onClick={() => setDays(range.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                days === range.id
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-text-muted hover:text-text-main'
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Keys are the user's own, so this spend is on their provider bill, not ours. Say so —
          otherwise these numbers look like something we are about to charge them for. */}
      <div className="flex gap-3 p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
        <Info size={16} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-xs text-text-muted leading-relaxed">
          These calls run on your own API keys and are billed by your provider, not by us. Costs are
          estimated from each model's published rates and are a guide, not an invoice.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 text-red-600 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-text-muted">Loading usage…</p>}

      {!loading && usage && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Estimated cost', value: formatUsd(usage.totals.estimatedCostUsd), icon: Activity },
              { label: 'Tokens', value: compactTokens.format(usage.totals.totalTokens), icon: Zap },
              { label: 'Calls', value: fullTokens.format(usage.totals.calls), icon: Activity },
            ].map(stat => (
              <div
                key={stat.label}
                className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]"
              >
                <div className="flex items-center gap-2 text-text-muted">
                  <stat.icon size={14} />
                  <span className="text-xs font-medium">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold text-text-main mt-1 tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Prompt-cache hits are billed at a steep discount or not at all, so this is the one number
              here that represents money already saved rather than money spent. */}
          {usage.totals.cachedPromptTokens > 0 && (
            <p className="text-xs text-text-muted">
              {fullTokens.format(usage.totals.cachedPromptTokens)} prompt tokens were served from your
              provider's cache at a discount.
            </p>
          )}

          {quota && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-text-main">Today's token budget</span>
                <span className={cn('tabular-nums', quota.nearLimit ? 'text-amber-600 font-semibold' : 'text-text-muted')}>
                  {fullTokens.format(usage.tokensUsedToday)} / {fullTokens.format(usage.dailyTokenLimit)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--border-color)] overflow-hidden">
                <div
                  className={cn('h-full rounded-full', quota.nearLimit ? 'bg-amber-500' : 'bg-[var(--primary)]')}
                  style={{ width: `${quota.fraction * 100}%` }}
                />
              </div>
              {quota.nearLimit && (
                <p className="text-xs text-amber-600">
                  Close to the daily limit. Further AI calls will be refused until it resets at 00:00 UTC.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
            <BreakdownTable
              title="By feature"
              caption="Which parts of the app spent your tokens."
              rows={usage.byOperation}
              formatKey={humanizeOperation}
            />
            <BreakdownTable
              title="By model"
              caption="Costliest model first."
              rows={usage.byModel}
            />
          </div>
        </>
      )}
    </div>
  );
};
