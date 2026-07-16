import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Brain, CheckCircle2, Hourglass, CalendarDays, Sparkles } from 'lucide-react';
import { analyticsService, type RetentionAnalytics } from '../../services/analyticsService';

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';
const PRIMARY = 'var(--primary)';

const StatTile: React.FC<{ icon: React.ElementType; label: string; value: string; hint?: string }> = ({ icon: Icon, label, value, hint }) => (
  <div className="bg-white rounded-2xl p-5 flex items-center gap-4" style={{ boxShadow: CARD_SHADOW }}>
    <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(13,148,136,0.08)' }}>
      <Icon size={20} className="text-[var(--primary)]" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-text-muted">{label}</p>
      <p className="text-2xl font-bold leading-none text-text-main tracking-tight mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-text-muted mt-1">{hint}</p>}
    </div>
  </div>
);

const ChartCard: React.FC<{ title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, meta, children, className }) => (
  <div className={`bg-white rounded-2xl p-5 ${className ?? ''}`} style={{ boxShadow: CARD_SHADOW }}>
    <div className="flex items-center justify-between gap-2 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      {meta}
    </div>
    {children}
  </div>
);

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <Sparkles size={22} className="text-zinc-300 mb-2" />
    <p className="text-xs text-text-muted max-w-[32ch] leading-relaxed">{children}</p>
  </div>
);

// ─── Forgetting curve (model prediction at the user's average stability) ────────────
const ForgettingCurveChart: React.FC<{ points: RetentionAnalytics['forgettingCurve']; avgStability: number }> = ({ points, avgStability }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0 || points.every(p => p.retention === 0)) {
    return <EmptyState>Review some flashcards and your personal forgetting curve will appear here.</EmptyState>;
  }

  const W = 560, H = 180, PAD = { l: 34, r: 12, t: 8, b: 22 };
  const maxDays = points[points.length - 1].days;
  const x = (d: number) => PAD.l + (d / maxDays) * (W - PAD.l - PAD.r);
  const y = (r: number) => PAD.t + (1 - r) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.days).toFixed(1)},${y(p.retention).toFixed(1)}`).join(' ');
  const area = `${path} L${x(maxDays).toFixed(1)},${y(0)} L${x(points[0].days).toFixed(1)},${y(0)} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Predicted recall probability over days since review">
        {/* Gridlines at 50% / 90% recall */}
        {[0.5, 0.9].map(g => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="rgba(0,0,0,0.06)" strokeDasharray="3 4" />
            <text x={PAD.l - 4} y={y(g) + 3} textAnchor="end" fontSize="9" fill="var(--text-muted)">{g * 100}%</text>
          </g>
        ))}
        <path d={area} fill="rgba(13,148,136,0.08)" />
        <path d={path} fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.days}>
            <circle cx={x(p.days)} cy={y(p.retention)} r={hover === i ? 5 : 3} fill={PRIMARY} stroke="white" strokeWidth="2" />
            {/* generous invisible hit target */}
            <circle
              cx={x(p.days)} cy={y(p.retention)} r={12} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            />
            {hover === i && (
              <text x={x(p.days)} y={y(p.retention) - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-main)">
                {Math.round(p.retention * 100)}% at {p.days}d
              </text>
            )}
          </g>
        ))}
        {[0, Math.round(maxDays / 3), Math.round((2 * maxDays) / 3), maxDays].map(d => (
          <text key={d} x={x(d)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{d}d</text>
        ))}
      </svg>
      <p className="text-[11px] text-text-muted mt-2">
        How fast an average card of yours fades without review (average stability {avgStability.toFixed(1)} days).
      </p>
    </div>
  );
};

// ─── Calibration: model-predicted recall vs. what actually happened ─────────────────
const CalibrationChart: React.FC<{ bins: RetentionAnalytics['calibration'] }> = ({ bins }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (bins.length === 0) {
    return <EmptyState>Once you've logged more reviews, we'll compare the model's predictions against your real recall.</EmptyState>;
  }

  const S = 190, PAD = { l: 30, r: 8, t: 8, b: 24 };
  const scale = (v: number, axis: 'x' | 'y') =>
    axis === 'x' ? PAD.l + v * (S - PAD.l - PAD.r) : PAD.t + (1 - v) * (S - PAD.t - PAD.b);
  const maxReviews = Math.max(...bins.map(b => b.reviews));

  return (
    <div>
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[260px] mx-auto" role="img" aria-label="Predicted vs actual recall calibration">
        {/* Perfect-calibration diagonal */}
        <line x1={scale(0, 'x')} y1={scale(0, 'y')} x2={scale(1, 'x')} y2={scale(1, 'y')} stroke="rgba(0,0,0,0.12)" strokeDasharray="3 4" />
        {[0, 0.5, 1].map(v => (
          <g key={v}>
            <text x={scale(v, 'x')} y={S - 8} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{v * 100}%</text>
            <text x={PAD.l - 4} y={scale(v, 'y') + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">{v * 100}%</text>
          </g>
        ))}
        {bins.map((b, i) => (
          <g key={b.binStart}>
            <circle
              cx={scale(b.predictedAvg, 'x')} cy={scale(b.actualRate, 'y')}
              r={Math.max(4, 4 + 5 * (b.reviews / maxReviews))}
              fill={PRIMARY} fillOpacity={hover === i ? 1 : 0.75} stroke="white" strokeWidth="2"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            />
            {hover === i && (
              <text x={scale(b.predictedAvg, 'x')} y={scale(b.actualRate, 'y') - 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-main)">
                predicted {Math.round(b.predictedAvg * 100)}% · got {Math.round(b.actualRate * 100)}% ({b.reviews})
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-text-muted mt-2 text-center">
        Dots on the dashed line = the scheduler predicts your memory accurately. Above it, you're beating the model.
      </p>
    </div>
  );
};

// ─── Stability distribution ──────────────────────────────────────────────────────────
const StabilityBars: React.FC<{ buckets: RetentionAnalytics['stabilityDistribution'] }> = ({ buckets }) => {
  const total = buckets.reduce((sum, b) => sum + b.cards, 0);
  if (total === 0) return <EmptyState>No reviewed cards yet.</EmptyState>;
  const max = Math.max(...buckets.map(b => b.cards));

  return (
    <div className="space-y-2.5">
      {buckets.map((b, i) => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-[11px] text-text-muted text-right tabular-nums">{b.label}</span>
          <div className="flex-1 h-4 rounded-md bg-zinc-50 overflow-hidden">
            <motion.div
              className="h-full rounded-md"
              style={{ background: PRIMARY, opacity: 0.55 + 0.45 * (i / Math.max(1, buckets.length - 1)) }}
              initial={{ width: 0 }}
              animate={{ width: `${(b.cards / max) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="w-8 shrink-0 text-[11px] font-semibold text-text-main tabular-nums">{b.cards}</span>
        </div>
      ))}
      <p className="text-[11px] text-text-muted pt-1">How long each card's memory lasts before dropping to 90% recall.</p>
    </div>
  );
};

// ─── Section ────────────────────────────────────────────────────────────────────────
export const RetentionSection: React.FC = () => {
  const [data, setData] = useState<RetentionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    analyticsService.getRetentionAnalytics()
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { /* leave empty state */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const reviewActivity = useMemo(() => data?.dailyReviews ?? [], [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={22} className="animate-spin text-zinc-300" />
      </div>
    );
  }

  if (!data || data.totalCardsTracked === 0) {
    return (
      <div className="bg-white rounded-2xl p-10" style={{ boxShadow: CARD_SHADOW }}>
        <EmptyState>
          Retention analytics unlock once you start reviewing flashcards. Head to the review queue —
          every rating trains your personal forgetting curve.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Brain} label="Predicted recall now" value={`${Math.round(data.predictedRetentionNow * 100)}%`} hint={`across ${data.totalCardsTracked} tracked cards`} />
        <StatTile
          icon={CheckCircle2}
          label="Actual recall"
          value={data.totalReviews > 0 ? `${Math.round(data.actualRetentionRate * 100)}%` : '—'}
          hint={data.totalReviews > 0 ? 'of reviews rated Hard or better' : 'logged from your next reviews'}
        />
        <StatTile icon={Hourglass} label="Average stability" value={`${data.averageStability.toFixed(1)}d`} hint="days until recall drops to 90%" />
        <StatTile icon={CalendarDays} label="Reviews (30d)" value={`${data.reviewsLast30Days}`} hint={`${data.totalReviews} logged all-time`} />
      </div>

      <ChartCard title="Forgetting curve">
        <ForgettingCurveChart points={data.forgettingCurve} avgStability={data.averageStability} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Prediction calibration">
          <CalibrationChart bins={data.calibration} />
        </ChartCard>
        <ChartCard title="Memory strength distribution">
          <StabilityBars buckets={data.stabilityDistribution} />
        </ChartCard>
      </div>

      {reviewActivity.length > 0 && (
        <ChartCard title="Review activity (30 days)">
          <div className="flex items-end gap-1 h-24">
            {reviewActivity.map(d => (
              <div key={d.date} className="flex-1 min-w-0 h-full flex flex-col justify-end group relative">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    background: PRIMARY,
                    height: `${Math.max(6, (d.reviews / Math.max(...reviewActivity.map(r => r.reviews))) * 100)}%`,
                  }}
                />
                <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {new Date(d.date).toLocaleDateString()} · {d.reviews} reviews · {Math.round(d.successRate * 100)}% recalled
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
};
