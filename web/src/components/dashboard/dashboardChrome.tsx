import React from 'react';
import { Sparkles } from 'lucide-react';

// The card chrome the dashboard's analytics and retention sections both render. Kept together so
// the two sections can't drift into looking subtly different from each other.

export const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.05)';
export const PRIMARY = 'var(--primary)';

export const StatTile: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
}> = ({ icon: Icon, label, value, hint }) => (
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

export const ChartCard: React.FC<{
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, meta, children, className }) => (
  <div className={`bg-white rounded-2xl p-5 ${className ?? ''}`} style={{ boxShadow: CARD_SHADOW }}>
    <div className="flex items-center justify-between gap-2 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      {meta}
    </div>
    {children}
  </div>
);

/** `widthCh` caps the line length; the two sections chose different measures for their copy. */
export const EmptyState: React.FC<{ children: React.ReactNode; widthCh?: number }> = ({ children, widthCh = 32 }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <Sparkles size={22} className="text-zinc-300 mb-2" />
    <p className="text-xs text-text-muted leading-relaxed" style={{ maxWidth: `${widthCh}ch` }}>{children}</p>
  </div>
);
