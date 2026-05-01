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
  iconColor = 'text-indigo-400',
  delta,
  deltaPositive,
  className,
}) => (
  <div className={cn(
    'flex flex-col gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6',
    className,
  )}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{label}</span>
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-white/5', iconColor)}>
        <Icon size={16} />
      </div>
    </div>
    <div className="flex items-end gap-2">
      <span className="text-3xl font-bold text-[var(--text-primary)] leading-none">{value}</span>
      {delta && (
        <span className={cn(
          'mb-0.5 text-xs font-medium',
          deltaPositive ? 'text-emerald-400' : 'text-red-400',
        )}>
          {delta}
        </span>
      )}
    </div>
  </div>
);
