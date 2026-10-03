import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  delta?: string;
  deltaPositive?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-emerald-600',
  delta,
  deltaPositive,
  className,
}) => (
  <div className={cn(
    'flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:gap-4 sm:p-6',
    className,
  )}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-medium leading-tight text-[var(--text-secondary)] uppercase tracking-wider sm:text-xs">{label}</span>
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/5 sm:h-8 sm:w-8', iconColor)}>
        <Icon size={16} />
      </div>
    </div>
    <div className="mt-auto flex flex-wrap items-end gap-x-2">
      <span className="text-2xl font-bold text-[var(--text-primary)] leading-none sm:text-3xl">{value}</span>
      {delta && (
        <span className={cn(
          'mb-0.5 text-[11px] font-medium sm:text-xs',
          deltaPositive ? 'text-emerald-600' : 'text-red-600',
        )}>
          {delta}
        </span>
      )}
    </div>
  </div>
);
