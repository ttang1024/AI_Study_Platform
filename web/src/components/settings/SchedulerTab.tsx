import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Gauge, Info, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '../common/Button';
import {
  flashcardService,
  type FsrsOptimizationResult,
  type FsrsSettings,
  type FsrsSettingsPatch,
  type ReviewForecast,
} from '../../services/flashcardService';
import { SettingsAlert } from './SettingsAlert';
import { PRIMARY } from '../dashboard/dashboardChrome';

/** Presets phrased as the trade-off the learner is actually making, not as a probability. */
const RETENTION_PRESETS = [
  { value: 0.85, label: 'Relaxed', hint: 'Fewer reviews, more forgetting' },
  { value: 0.9, label: 'Balanced', hint: 'The FSRS default' },
  { value: 0.95, label: 'Thorough', hint: 'More reviews, less forgetting' },
] as const;

const MAX_INTERVAL_PRESETS = [
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
  { value: 1825, label: '5 years' },
  { value: 36500, label: 'No limit' },
] as const;

const NEW_PER_DAY_PRESETS = [0, 5, 10, 20, 40] as const;
const REVIEWS_PER_DAY_PRESETS = [50, 100, 200, 0] as const;

const BACKLOG_SPREADS = [3, 7, 14] as const;

// amber-500, matching the Tailwind amber the rest of the app warns in. Inline rather than a class
// because it is an SVG fill.
const OVER_LIMIT = '#f59e0b';

const percent = (n: number) => `${Math.round(n * 100)}%`;


/**
 * Fourteen days of scheduled load. Bars over the user's own reviews-per-day ceiling are marked,
 * because that is the only reading here that asks for a decision — everything else is context.
 */
const ForecastStrip: React.FC<{ forecast: ReviewForecast }> = ({ forecast }) => {
  const [hover, setHover] = useState<number | null>(null);

  if (forecast.days.every(d => d.count === 0)) {
    return <p className="text-xs text-text-muted py-4 text-center">Nothing is scheduled in the next two weeks.</p>;
  }

  const peak = Math.max(1, ...forecast.days.map(d => d.count));

  const W = 280, H = 72, PAD_B = 14;
  const slot = W / forecast.days.length;
  const barW = Math.max(3, slot - 3);
  const limit = forecast.maxReviewsPerDay;
  const limitY = limit > 0 && limit <= peak ? (H - PAD_B) * (1 - limit / peak) : null;

  const label = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cards due per day over the next two weeks">
        {limitY !== null && (
          <line x1={0} y1={limitY} x2={W} y2={limitY} stroke="rgba(0,0,0,0.2)" strokeDasharray="3 4" />
        )}
        {forecast.days.map((d, i) => {
          const h = d.count === 0 ? 1 : Math.max(2, (H - PAD_B) * (d.count / peak));
          const over = limit > 0 && d.count > limit;
          return (
            <rect
              key={d.day}
              x={i * slot + (slot - barW) / 2}
              y={H - PAD_B - h}
              width={barW}
              height={h}
              rx={2}
              fill={over ? OVER_LIMIT : PRIMARY}
              fillOpacity={hover === null || hover === i ? 0.85 : 0.4}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        <text x={0} y={H - 3} fontSize="8" fill="var(--text-muted)">{label(forecast.days[0].day)}</text>
        <text x={W} y={H - 3} fontSize="8" textAnchor="end" fill="var(--text-muted)">
          {label(forecast.days[forecast.days.length - 1].day)}
        </text>
      </svg>
      <p className="text-[11px] text-text-muted mt-1 text-center h-4">
        {hover !== null
          ? `${label(forecast.days[hover].day)} · ${forecast.days[hover].count} due`
          : limitY !== null
            ? `Dashed line is your ${limit}-a-day limit.`
            : `Busiest day: ${peak} cards.`}
      </p>
    </div>
  );
};

export const SchedulerTab: React.FC = () => {
  const [settings, setSettings] = useState<FsrsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<FsrsOptimizationResult | null>(null);
  const [forecast, setForecast] = useState<ReviewForecast | null>(null);
  const [spreading, setSpreading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    flashcardService
      .getFsrsSettings()
      .then(s => { if (!cancelled) setSettings(s); })
      .catch(() => { if (!cancelled) setError('Could not load your scheduler settings.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    // The forecast is illustrative, not required — a failure here leaves the settings usable.
    flashcardService
      .getReviewForecast(14)
      .then(f => { if (!cancelled) setForecast(f); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // Each control saves on change: there is one field per control and no validation to batch,
  // so a Save button would only add a step between the choice and its effect.
  const patch = useCallback(async (change: FsrsSettingsPatch) => {
    setError(null);
    setNotice(null);
    setSaving(true);
    const previous = settings;
    setSettings(s => (s ? { ...s, ...change } : s));
    try {
      setSettings(await flashcardService.updateFsrsSettings(change));
    } catch {
      setSettings(previous);
      setError('Could not save that change.');
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const optimize = async () => {
    setError(null);
    setNotice(null);
    setOptimizing(true);
    try {
      const result = await flashcardService.optimizeFsrsWeights();
      setLastRun(result);
      setNotice(
        result.applied
          ? `Tuned on ${result.reviewCount.toLocaleString()} reviews — ${percent(result.improvement)} better calibrated.`
          : 'Your history is already best explained by the default scheduler, so nothing changed.'
      );
      setSettings(await flashcardService.getFsrsSettings());
    } catch {
      setError('Could not tune the scheduler. Try again once you have more reviews.');
    } finally {
      setOptimizing(false);
    }
  };

  const resetWeights = async () => {
    setError(null);
    setNotice(null);
    setOptimizing(true);
    try {
      setSettings(await flashcardService.resetFsrsWeights());
      setLastRun(null);
      setNotice('Back to the default scheduler.');
    } catch {
      setError('Could not reset the scheduler.');
    } finally {
      setOptimizing(false);
    }
  };

  const spreadBacklog = async (days: number) => {
    setError(null);
    setNotice(null);
    setSpreading(true);
    try {
      const result = await flashcardService.rescheduleBacklog(days);
      setNotice(
        result.moved === 0
          ? 'Nothing is overdue.'
          : `Spread ${result.moved.toLocaleString()} card${result.moved === 1 ? '' : 's'} over ${result.days} days, about ${result.perDay} a day.`
      );
      setForecast(await flashcardService.getReviewForecast(14));
    } catch {
      setError('Could not reschedule the backlog.');
    } finally {
      setSpreading(false);
    }
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-[var(--bg-sidebar)]" />;
  }

  if (!settings) {
    return <SettingsAlert kind="error">{error ?? 'Scheduler settings are unavailable.'}</SettingsAlert>;
  }

  const canOptimize = settings.reviewCount >= settings.minimumReviewsToOptimize;
  const progress = Math.min(100, Math.round((settings.reviewCount / settings.minimumReviewsToOptimize) * 100));

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-bold text-text-main">Review Scheduler</h3>
        <p className="text-sm text-text-muted mt-1">
          How FSRS decides when each flashcard comes back. Changes apply to reviews from here on —
          cards already scheduled keep their current due date.
        </p>
      </div>

      {error && <SettingsAlert kind="error">{error}</SettingsAlert>}
      {notice && <SettingsAlert kind="success">{notice}</SettingsAlert>}

      {/* ── Desired retention ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium text-text-main">Target retention</label>
          <p className="text-xs text-text-muted mt-0.5">
            The chance you want of remembering a card when it comes up. Aiming higher means seeing
            each card more often.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {RETENTION_PRESETS.map(preset => (
            <button
              key={preset.value}
              type="button"
              disabled={saving}
              onClick={() => patch({ desiredRetention: preset.value })}
              className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${
                Math.abs(settings.desiredRetention - preset.value) < 0.001
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border-color)] hover:bg-[var(--bg-sidebar)]'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-text-main">{preset.label}</span>
                <span className="text-xs text-text-muted">{percent(preset.value)}</span>
              </div>
              <p className="text-xs text-text-muted mt-1">{preset.hint}</p>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={70}
            max={98}
            step={1}
            disabled={saving}
            value={Math.round(settings.desiredRetention * 100)}
            onChange={e => setSettings(s => (s ? { ...s, desiredRetention: Number(e.target.value) / 100 } : s))}
            onMouseUp={e => patch({ desiredRetention: Number((e.target as HTMLInputElement).value) / 100 })}
            onTouchEnd={e => patch({ desiredRetention: Number((e.target as HTMLInputElement).value) / 100 })}
            className="flex-1 accent-[var(--primary)]"
            aria-label="Target retention"
          />
          <span className="w-12 text-right text-sm font-medium text-text-main tabular-nums">
            {percent(settings.desiredRetention)}
          </span>
        </div>
      </section>

      {/* ── Maximum interval ──────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium text-text-main">Maximum interval</label>
          <p className="text-xs text-text-muted mt-0.5">
            The furthest out a card can ever be scheduled. Useful when an exam means nothing should
            disappear for years.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MAX_INTERVAL_PRESETS.map(preset => (
            <button
              key={preset.value}
              type="button"
              disabled={saving}
              onClick={() => patch({ maximumIntervalDays: preset.value })}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                settings.maximumIntervalDays === preset.value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-text-main'
                  : 'border-[var(--border-color)] text-text-muted hover:bg-[var(--bg-sidebar)]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Fuzz ──────────────────────────────────────────────────────── */}
      <section>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enableFuzz}
            disabled={saving}
            onChange={e => patch({ enableFuzz: e.target.checked })}
            className="mt-0.5 accent-[var(--primary)]"
          />
          <span>
            <span className="text-sm font-medium text-text-main">Spread out due dates</span>
            <p className="text-xs text-text-muted mt-0.5">
              Nudges intervals by a few percent so a batch of cards generated together doesn't come
              back as one giant pile every time.
            </p>
          </span>
        </label>
      </section>

      {/* ── Daily limits ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium text-text-main">New cards per day</label>
          <p className="text-xs text-text-muted mt-0.5">
            How many never-seen cards a session introduces. Every new card is a review commitment for
            months, so this is the dial that sets your long-run workload.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {NEW_PER_DAY_PRESETS.map(value => (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => patch({ newCardsPerDay: value })}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                settings.newCardsPerDay === value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-text-main'
                  : 'border-[var(--border-color)] text-text-muted hover:bg-[var(--bg-sidebar)]'
              }`}
            >
              {value === 0 ? 'None' : value}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <label className="text-sm font-medium text-text-main">Reviews per day</label>
          <p className="text-xs text-text-muted mt-0.5">
            A ceiling on the whole queue, so a heavy day stays finishable. Cards over the limit wait
            rather than disappearing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {REVIEWS_PER_DAY_PRESETS.map(value => (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => patch({ maxReviewsPerDay: value })}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                settings.maxReviewsPerDay === value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-text-main'
                  : 'border-[var(--border-color)] text-text-muted hover:bg-[var(--bg-sidebar)]'
              }`}
            >
              {value === 0 ? 'No limit' : value}
            </button>
          ))}
        </div>
      </section>

      {/* ── Forecast + backlog ────────────────────────────────────────── */}
      {forecast && (
        <section className="rounded-xl border border-[var(--border-color)] p-4 space-y-4">
          <div className="flex items-start gap-3">
            <CalendarClock size={18} className="mt-0.5 text-[var(--primary)] shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-text-main">The next two weeks</h4>
              <p className="text-xs text-text-muted mt-0.5">
                What is already scheduled, before anything you study today adds to it.
              </p>
            </div>
          </div>

          <ForecastStrip forecast={forecast} />

          {forecast.overdue > 0 && (
            <div className="space-y-2 rounded-lg bg-[var(--bg-sidebar)] p-3">
              <p className="text-xs text-text-main">
                <span className="font-bold">{forecast.overdue.toLocaleString()}</span> card
                {forecast.overdue === 1 ? ' is' : 's are'} overdue. Spreading them out moves only the
                due dates — what the scheduler thinks you know is untouched.
              </p>
              <div className="flex flex-wrap gap-2">
                {BACKLOG_SPREADS.map(days => (
                  <Button
                    key={days}
                    size="sm"
                    variant="outline"
                    disabled={spreading}
                    onClick={() => spreadBacklog(days)}
                  >
                    {spreading ? 'Spreading…' : `Over ${days} days`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Optimizer ─────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--border-color)] p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Gauge size={18} className="mt-0.5 text-[var(--primary)] shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-text-main">Tune to your memory</h4>
            <p className="text-xs text-text-muted mt-0.5">
              FSRS ships with weights averaged over many learners. Once you have enough review
              history, they can be refitted to how <em>you</em> actually forget.
            </p>
          </div>
        </div>

        {settings.usingOptimizedWeights ? (
          <div className="rounded-lg bg-[var(--bg-sidebar)] p-3 text-xs text-text-muted space-y-1">
            <p className="text-text-main font-medium">Using your own weights</p>
            <p>
              Fitted on {settings.reviewsAtOptimization.toLocaleString()} reviews
              {settings.weightsOptimizedAt && ` on ${new Date(settings.weightsOptimizedAt).toLocaleDateString()}`}.
            </p>
            {settings.logLossBefore != null && settings.logLossAfter != null && (
              <p className="tabular-nums">
                Prediction error {settings.logLossBefore.toFixed(4)} → {settings.logLossAfter.toFixed(4)} (lower is better).
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{settings.reviewCount.toLocaleString()} reviews logged</span>
              <span>{settings.minimumReviewsToOptimize.toLocaleString()} needed</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-sidebar)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {lastRun && !lastRun.applied && (
          <div className="flex items-start gap-2 text-xs text-text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>The default weights already explain your reviews as well as anything fitted, so nothing changed.</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={optimize} disabled={!canOptimize || optimizing}>
            <Sparkles size={14} className="mr-2" />
            {optimizing ? 'Tuning…' : settings.usingOptimizedWeights ? 'Re-tune' : 'Tune scheduler'}
          </Button>
          {settings.usingOptimizedWeights && (
            <Button size="sm" variant="outline" onClick={resetWeights} disabled={optimizing}>
              <RotateCcw size={14} className="mr-2" />
              Use defaults
            </Button>
          )}
        </div>

        {!canOptimize && (
          <p className="text-xs text-text-muted">
            Keep reviewing — tuning needs {(settings.minimumReviewsToOptimize - settings.reviewCount).toLocaleString()} more reviews
            before it can say anything meaningful.
          </p>
        )}
      </section>
    </div>
  );
};
