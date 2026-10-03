import React from 'react';
import { cn } from '../../utils/cn';

export const ArtifactMetric: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, value, color, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-xl border bg-white p-3 text-left transition-all hover:-translate-y-px hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30',
      active ? 'border-primary shadow-sm' : 'border-[var(--border-color)]',
    )}
  >
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums text-text-main">{value}</p>
        <p className="text-[11px] font-semibold text-text-muted">{label}</p>
      </div>
    </div>
  </button>
);
