import React from 'react';
import { Eye, Users, MousePointerClick, Layers3, Monitor, Smartphone, Tablet, HelpCircle, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PageVisitAnalytics } from '../../types';
import { StatCard } from '../common/StatCard';
import { BarTrend } from '../common/BarTrend';
import { ErrorBanner } from '../common/ErrorBanner';
import { formatNumber } from '../../utils/format';
import { cn } from '../../utils/cn';
import { VISIT_WINDOWS, type VisitWindow } from '../../hooks/usePageVisitAnalytics';

const DEVICE_ICONS: Record<string, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: HelpCircle,
};

interface PageVisitsSectionProps {
  data: PageVisitAnalytics | null;
  error: string;
  days: VisitWindow;
  onDaysChange: (days: VisitWindow) => void;
}

/**
 * Page views: how much traffic the app gets, where it lands and where it comes from.
 *
 * Visits and unique visitors are both shown everywhere they differ, because on a study app the
 * gap between them is the story — one person opening thirty pages is not thirty people.
 */
export const PageVisitsSection: React.FC<PageVisitsSectionProps> = ({ data, error, days, onDaysChange }) => {
  const windowLabel = `last ${days} days`;

  return (
    <div className="mb-6 sm:mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Page visits</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Every route the web app serves, signed in or not — bots excluded
          </p>
        </div>
        <div className="flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5">
          {VISIT_WINDOWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onDaysChange(option)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                option === days
                  ? 'bg-emerald-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-black/5',
              )}
            >
              {option}d
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      {!error && !data && (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] animate-pulse" />
          ))}
        </div>
      )}

      {data && <PageVisitsBody data={data} windowLabel={windowLabel} />}
    </div>
  );
};

const PageVisitsBody: React.FC<{ data: PageVisitAnalytics; windowLabel: string }> = ({ data, windowLabel }) => {
  const { totals, visitTrend, visitorTrend, topPages, topReferrers, devices } = data;
  const maxPageVisits = Math.max(1, ...topPages.map((p) => p.visits));
  const maxReferrer = Math.max(1, ...topReferrers.map((r) => r.visits));
  const deviceTotal = Math.max(1, devices.reduce((sum, d) => sum + d.visits, 0));
  const signedInPct = totals.visits > 0 ? Math.round((totals.signedInVisits / totals.visits) * 100) : 0;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:mb-5 sm:gap-5 sm:grid-cols-4">
        <StatCard
          label={`Visits (${windowLabel})`}
          value={formatNumber(totals.visits)}
          icon={Eye}
          iconColor="text-sky-600"
          delta={`${formatNumber(totals.visitsToday)} today`}
          deltaPositive={totals.visitsToday > 0}
        />
        <StatCard
          label="Unique Visitors"
          value={formatNumber(totals.uniqueVisitors)}
          icon={Users}
          iconColor="text-violet-600"
        />
        <StatCard
          label="Sessions"
          value={formatNumber(totals.sessions)}
          icon={MousePointerClick}
          iconColor="text-amber-600"
          delta={`${totals.visitsPerSession} pages each`}
          deltaPositive
        />
        <StatCard
          label="Signed In"
          value={`${signedInPct}%`}
          icon={Layers3}
          iconColor="text-emerald-600"
          // Anonymous traffic is the top of the funnel, not a problem to flag in red.
          delta={`${formatNumber(totals.anonymousVisits)} anonymous`}
          deltaPositive
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:mb-5 sm:gap-5 lg:grid-cols-2">
        <BarTrend
          title="Page views"
          subtitle={windowLabel}
          data={visitTrend}
          barClass="bg-sky-500"
          formatValue={(v) => `${formatNumber(v)} view${v === 1 ? '' : 's'}`}
        />
        <BarTrend
          title="Unique visitors"
          subtitle={windowLabel}
          data={visitorTrend}
          barClass="bg-violet-500"
          formatValue={(v) => `${formatNumber(v)} visitor${v === 1 ? '' : 's'}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        {/* Most visited pages */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)] sm:mb-5">Most visited pages</h3>
          {topPages.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">No visits recorded yet.</p>
          ) : (
            <div className="space-y-3.5">
              {topPages.map((page) => (
                <div key={page.path} className="flex items-center gap-2 sm:gap-3">
                  <span
                    className="w-24 shrink-0 truncate font-mono text-[11px] text-[var(--text-secondary)] sm:w-40 sm:text-xs"
                    title={page.path}
                  >
                    {page.path}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: `${Math.max(2, (page.visits / maxPageVisits) * 100)}%` }}
                    />
                  </div>
                  <span
                    className="w-16 shrink-0 text-right text-[11px] font-medium text-[var(--text-primary)] sm:w-20 sm:text-xs"
                    title={`${formatNumber(page.uniqueVisitors)} unique visitor${page.uniqueVisitors === 1 ? '' : 's'}`}
                  >
                    {formatNumber(page.visits)}
                    <span className="ml-1 font-normal text-[var(--text-secondary)]">
                      /{formatNumber(page.uniqueVisitors)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 sm:space-y-5">
          {/* Where the traffic comes from */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2 sm:mb-5">
              <ExternalLink size={15} className="text-teal-600" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top referrers</h3>
            </div>
            {topReferrers.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
                All traffic so far is direct — no external links yet.
              </p>
            ) : (
              <div className="space-y-3.5">
                {topReferrers.map((referrer) => (
                  <div key={referrer.referrer} className="flex items-center gap-2 sm:gap-3">
                    <span className="w-24 shrink-0 truncate text-[11px] text-[var(--text-secondary)] sm:w-36 sm:text-xs" title={referrer.referrer}>
                      {referrer.referrer}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${Math.max(2, (referrer.visits / maxReferrer) * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[11px] font-medium text-[var(--text-primary)] sm:w-12 sm:text-xs">
                      {formatNumber(referrer.visits)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Devices */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:p-6">
            <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)] sm:mb-5">Devices</h3>
            {devices.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-secondary)]">No visits recorded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {devices.map((device) => {
                  const Icon = DEVICE_ICONS[device.device] ?? HelpCircle;
                  const pct = Math.round((device.visits / deviceTotal) * 100);
                  return (
                    <div key={device.device} className="rounded-xl bg-black/5 p-3 text-center">
                      <Icon size={16} className="mx-auto mb-1.5 text-[var(--text-secondary)]" />
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{pct}%</p>
                      <p className="text-[10px] capitalize text-[var(--text-secondary)]">{device.device}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
