import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import billingService, { type MyPlan, type Plan, type PlanKey } from '../../services/billingService';

const formatLimit = (tokens: number): string =>
  tokens <= 0 ? 'Unlimited' : `${(tokens / 1000).toLocaleString()}k tokens/day`;

const formatCount = (n: number): string => (n <= 0 ? 'Unlimited' : n.toLocaleString());

export const PlanTab: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mine, setMine] = useState<MyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PlanKey | 'portal' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const [p, m] = await Promise.allSettled([billingService.getPlans(), billingService.getMyPlan()]);
      if (p.status === 'fulfilled') setPlans(p.value.data?.data ?? []);
      if (m.status === 'fulfilled') setMine(m.value.data?.data ?? null);
      setLoading(false);
    })();
  }, []);

  const upgrade = async (planKey: PlanKey) => {
    setBusy(planKey);
    setError('');
    try {
      const here = window.location.href;
      const res = await billingService.startCheckout(planKey, here, here);
      const url = res.data?.data?.url;
      if (url) window.location.href = url;
      else setError('Could not start checkout. Please try again.');
    } catch {
      setError('Could not start checkout. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy('portal');
    setError('');
    try {
      const res = await billingService.openPortal(window.location.href);
      const url = res.data?.data;
      if (url) window.location.href = url;
      else setError('Could not open the billing portal.');
    } catch {
      setError('Could not open the billing portal.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-sm text-text-muted">Loading…</p>;

  const usagePercent =
    mine && mine.dailyTokenLimit > 0
      ? Math.min(100, Math.round((100 * mine.tokensUsedToday) / mine.dailyTokenLimit))
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-text-main">Plan</h2>
        <p className="text-sm text-text-muted mt-1">Your current plan and today's AI usage against it.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {mine && (
        <section className="rounded-xl border border-border p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-text-main">
                {mine.plan.displayName}
                {mine.source === 'organization' && (
                  <span className="ml-2 text-xs font-normal text-text-muted">via your organization</span>
                )}
              </p>
              {mine.expiresAt && (
                <p className="text-xs text-text-muted mt-0.5">
                  {mine.status === 'cancelled' ? 'Access ends' : 'Renews'}{' '}
                  {new Date(mine.expiresAt).toLocaleDateString()}
                </p>
              )}
              {mine.status === 'past_due' && (
                <p className="text-xs text-amber-600 mt-0.5">
                  Payment failed — please update your card to avoid losing access.
                </p>
              )}
            </div>

            {mine.canManageBilling && (
              <button
                onClick={() => void manage()}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-surface-hover text-sm disabled:opacity-50"
              >
                {busy === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage billing
              </button>
            )}
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>AI usage today</span>
              <span>
                {mine.tokensUsedToday.toLocaleString()} /{' '}
                {mine.dailyTokenLimit > 0 ? mine.dailyTokenLimit.toLocaleString() : '∞'} tokens
              </span>
            </div>
            {mine.dailyTokenLimit > 0 && (
              <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className={usagePercent >= 90 ? 'h-full bg-red-500' : 'h-full bg-teal-500'}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            )}
            <p className="text-xs text-text-muted mt-1.5">Resets at midnight UTC.</p>
          </div>
        </section>
      )}

      {/* Hidden entirely on self-hosted installs, where there is nothing to upgrade to. */}
      {mine?.billingEnabled && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">Available plans</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.key === mine.plan.key;
              return (
                <div
                  key={plan.key}
                  className={`rounded-xl border p-5 ${isCurrent ? 'border-teal-500' : 'border-border'}`}
                >
                  <p className="font-semibold text-text-main">{plan.displayName}</p>
                  <p className="text-2xl font-bold text-text-main mt-1">
                    ${plan.monthlyPriceUsd}
                    <span className="text-sm font-normal text-text-muted">/mo</span>
                  </p>

                  <ul className="mt-4 space-y-1.5 text-xs text-text-muted">
                    <Feature>{formatLimit(plan.dailyTokenLimit)}</Feature>
                    <Feature>{formatCount(plan.maxClassrooms)} classrooms</Feature>
                    <Feature>{formatCount(plan.maxStudentsPerClassroom)} students per class</Feature>
                    {plan.includesHostedKeys && <Feature>AI key included — no setup</Feature>}
                  </ul>

                  <button
                    onClick={() => void upgrade(plan.key)}
                    disabled={isCurrent || plan.key === 'free' || busy !== null}
                    className="mt-5 w-full px-3 py-2 rounded-lg text-sm bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-default"
                  >
                    {isCurrent ? 'Current plan' : busy === plan.key ? 'Redirecting…' : 'Upgrade'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

const Feature: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="flex items-start gap-1.5">
    <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
    <span>{children}</span>
  </li>
);

export default PlanTab;
