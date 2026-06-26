import React from 'react';
import { cn } from '../../utils/cn';
import type { FeedbackStatus, FeedbackType } from '../../types';

const typeStyles: Record<FeedbackType, string> = {
  bug: 'bg-red-500/10 text-red-700 border-red-500/20',
  feature: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  general: 'bg-sky-500/10 text-sky-700 border-sky-500/20',
};

const typeLabels: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  general: 'General',
};

const statusStyles: Record<FeedbackStatus, string> = {
  new: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  read: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20',
  in_progress: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  resolved: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
  archived: 'bg-zinc-400/20 text-zinc-500 border-zinc-400/30',
};

const statusLabels: Record<FeedbackStatus, string> = {
  new: 'New',
  read: 'Read',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  archived: 'Archived',
};

interface TypeBadgeProps {
  type: FeedbackType;
  className?: string;
}

interface StatusBadgeProps {
  status: FeedbackStatus;
  className?: string;
}

const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium';

export const TypeBadge: React.FC<TypeBadgeProps> = ({ type, className }) => (
  <span className={cn(base, typeStyles[type], className)}>{typeLabels[type]}</span>
);

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => (
  <span className={cn(base, statusStyles[status], className)}>{statusLabels[status]}</span>
);
