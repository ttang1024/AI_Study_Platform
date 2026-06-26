import React, { useMemo } from 'react';
import { cn } from '../../utils/cn';

export interface ChartDefinition {
  type: 'bar' | 'line' | 'pie';
  title?: string;
  labels: string[];
  datasets: Array<{
    label?: string;
    data: number[];
    color?: string;
  }>;
  xLabel?: string;
  yLabel?: string;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

// SVG viewBox dimensions
const VW = 480, VH = 300;
const ML = 56, MT = 36, MR = 20, MB = 56;
const CW = VW - ML - MR;  // chart width  = 404
const CH = VH - MT - MB;  // chart height = 208

function fmt(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil((v * 1.12) / e) * e;
}

function truncate(s: string, max = 9) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

const BarChart: React.FC<{ c: ChartDefinition }> = ({ c }) => {
  const { labels, datasets, xLabel, yLabel } = c;
  const maxVal = niceMax(Math.max(...datasets.flatMap(d => d.data), 0));
  const nGroups = labels.length;
  const nSeries = datasets.length;
  const groupW = CW / nGroups;
  const padFrac = 0.15;
  const barW = (groupW * (1 - padFrac * 2)) / nSeries;
  const Y_TICKS = 5;

  return (
    <g transform={`translate(${ML},${MT})`}>
      {/* Axes */}
      <line x1={0} y1={0} x2={0} y2={CH} stroke="#d1d5db" strokeWidth={1} />
      <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#d1d5db" strokeWidth={1} />

      {/* Y grid + ticks */}
      {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
        const v = (maxVal / Y_TICKS) * i;
        const y = CH - (v / maxVal) * CH;
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={CW} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={-8} y={y + 3.5} textAnchor="end" fontSize={10} fill="#9ca3af">{fmt(v)}</text>
          </g>
        );
      })}

      {/* Bars */}
      {datasets.map((series, si) => {
        const color = series.color ?? COLORS[si % COLORS.length];
        return series.data.map((val, li) => {
          const barH = Math.max((val / maxVal) * CH, 0);
          const x = li * groupW + groupW * padFrac + si * barW;
          const y = CH - barH;
          return (
            <g key={`${si}-${li}`}>
              <rect x={x} y={y} width={barW * 0.9} height={barH} fill={color} rx={3} />
              {barH > 20 && (
                <text x={x + barW * 0.45} y={y + 12} textAnchor="middle" fontSize={9} fill="white" fontWeight={700}>
                  {fmt(val)}
                </text>
              )}
            </g>
          );
        });
      })}

      {/* X labels */}
      {labels.map((label, i) => (
        <text key={i} x={i * groupW + groupW / 2} y={CH + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
          {truncate(label)}
        </text>
      ))}

      {/* Axis labels */}
      {xLabel && (
        <text x={CW / 2} y={CH + 36} textAnchor="middle" fontSize={11} fill="#6b7280" fontWeight={500}>{xLabel}</text>
      )}
      {yLabel && (
        <text transform={`translate(-44,${CH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#6b7280" fontWeight={500}>{yLabel}</text>
      )}

      {/* Legend (only for multiple series) */}
      {nSeries > 1 && (
        <g transform={`translate(0,${-MT + 4})`}>
          {datasets.map((s, si) => (
            <g key={si} transform={`translate(${si * 110},0)`}>
              <rect width={10} height={10} fill={s.color ?? COLORS[si % COLORS.length]} rx={2} />
              <text x={14} y={9} fontSize={10} fill="#6b7280">{truncate(s.label ?? `Series ${si + 1}`, 12)}</text>
            </g>
          ))}
        </g>
      )}
    </g>
  );
};

// ── Line chart ────────────────────────────────────────────────────────────────

const LineChart: React.FC<{ c: ChartDefinition }> = ({ c }) => {
  const { labels, datasets, xLabel, yLabel } = c;
  const allVals = datasets.flatMap(d => d.data);
  const maxVal = niceMax(Math.max(...allVals, 0));
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;
  const xStep = labels.length > 1 ? CW / (labels.length - 1) : 0;
  const Y_TICKS = 5;
  const yPos = (v: number) => CH - ((v - minVal) / range) * CH;

  return (
    <g transform={`translate(${ML},${MT})`}>
      {/* Axes */}
      <line x1={0} y1={0} x2={0} y2={CH} stroke="#d1d5db" strokeWidth={1} />
      <line x1={0} y1={CH} x2={CW} y2={CH} stroke="#d1d5db" strokeWidth={1} />

      {/* Y grid + ticks */}
      {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
        const v = minVal + (range / Y_TICKS) * i;
        const y = yPos(v);
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={CW} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={-8} y={y + 3.5} textAnchor="end" fontSize={10} fill="#9ca3af">{fmt(v)}</text>
          </g>
        );
      })}

      {/* Lines + area + dots */}
      {datasets.map((series, si) => {
        const color = series.color ?? COLORS[si % COLORS.length];
        const pts = series.data.map((v, i) => [i * xStep, yPos(v)] as [number, number]);
        const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${CH} L${pts[0][0].toFixed(1)},${CH} Z`;
        return (
          <g key={si}>
            <path d={areaPath} fill={color} fillOpacity={0.1} />
            <path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={4} fill={color} stroke="white" strokeWidth={1.5} />
            ))}
          </g>
        );
      })}

      {/* X labels */}
      {labels.map((label, i) => (
        <text key={i} x={i * xStep} y={CH + 16} textAnchor="middle" fontSize={10} fill="#6b7280">
          {truncate(label)}
        </text>
      ))}

      {/* Axis labels */}
      {xLabel && (
        <text x={CW / 2} y={CH + 36} textAnchor="middle" fontSize={11} fill="#6b7280" fontWeight={500}>{xLabel}</text>
      )}
      {yLabel && (
        <text transform={`translate(-44,${CH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#6b7280" fontWeight={500}>{yLabel}</text>
      )}

      {/* Legend */}
      {datasets.length > 1 && (
        <g transform={`translate(0,${-MT + 4})`}>
          {datasets.map((s, si) => (
            <g key={si} transform={`translate(${si * 110},0)`}>
              <rect y={3.5} width={10} height={3} fill={s.color ?? COLORS[si % COLORS.length]} rx={1} />
              <text x={14} y={9} fontSize={10} fill="#6b7280">{truncate(s.label ?? `Series ${si + 1}`, 12)}</text>
            </g>
          ))}
        </g>
      )}
    </g>
  );
};

// ── Pie chart ─────────────────────────────────────────────────────────────────

const PieChart: React.FC<{ c: ChartDefinition }> = ({ c }) => {
  const { labels, datasets } = c;
  const data = datasets[0]?.data ?? [];
  const total = data.reduce((a, b) => a + b, 0) || 1;
  const pieR = Math.min(CW * 0.5, CH) * 0.42;
  const cx = CW * 0.38;
  const cy = CH / 2;
  const legendX = CW * 0.72;

  let angle = -Math.PI / 2;

  return (
    <g transform={`translate(${ML},${MT})`}>
      {data.map((val, i) => {
        const sweep = (val / total) * 2 * Math.PI;
        const end = angle + sweep;
        const x1 = cx + pieR * Math.cos(angle);
        const y1 = cy + pieR * Math.sin(angle);
        const x2 = cx + pieR * Math.cos(end);
        const y2 = cy + pieR * Math.sin(end);
        const large = sweep > Math.PI ? 1 : 0;
        const color = COLORS[i % COLORS.length];
        const mid = angle + sweep / 2;
        const lx = cx + pieR * 0.62 * Math.cos(mid);
        const ly = cy + pieR * 0.62 * Math.sin(mid);
        const pct = Math.round((val / total) * 100);
        angle = end;
        return (
          <g key={i}>
            <path
              d={`M${cx.toFixed(1)},${cy.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${pieR},${pieR} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`}
              fill={color} stroke="white" strokeWidth={2}
            />
            {pct > 5 && (
              <text x={lx.toFixed(1)} y={(ly + 4).toFixed(1)} textAnchor="middle" fontSize={10} fill="white" fontWeight={700}>
                {pct}%
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      {labels.map((label, i) => {
        const pct = Math.round((data[i] / total) * 100);
        return (
          <g key={i} transform={`translate(${legendX},${i * 22})`}>
            <rect width={11} height={11} fill={COLORS[i % COLORS.length]} rx={2} />
            <text x={15} y={9.5} fontSize={10} fill="#6b7280">
              {truncate(label, 13)} ({pct}%)
            </text>
          </g>
        );
      })}
    </g>
  );
};

// ── Public component ──────────────────────────────────────────────────────────

interface CardChartProps {
  /** JSON string containing a ChartDefinition */
  data: string;
  className?: string;
}

export const CardChart: React.FC<CardChartProps> = ({ data, className }) => {
  const chart = useMemo<ChartDefinition | null>(() => {
    try {
      const parsed = JSON.parse(data);
      if (parsed?.labels && parsed?.datasets) return parsed as ChartDefinition;
      return null;
    } catch {
      return null;
    }
  }, [data]);

  if (!chart) {
    return <p className="text-sm italic text-text-muted">Chart data unavailable</p>;
  }

  return (
    <div className={cn('w-full', className)}>
      {chart.title && (
        <p className="text-center text-sm font-bold text-text-main mb-1">{chart.title}</p>
      )}
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" className="overflow-visible">
        {chart.type === 'bar'  && <BarChart  c={chart} />}
        {chart.type === 'line' && <LineChart c={chart} />}
        {chart.type === 'pie'  && <PieChart  c={chart} />}
      </svg>
    </div>
  );
};
