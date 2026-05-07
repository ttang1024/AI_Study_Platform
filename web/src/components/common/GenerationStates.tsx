import React from 'react';
import { AlertCircle, RotateCcw, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

type EmptyGenerationVariant = 'compact' | 'default';

interface EmptyGenerationStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  variant?: EmptyGenerationVariant;
  actionDisabled?: boolean;
  disabledReason?: string;
}

const emptyVariantStyles: Record<EmptyGenerationVariant, {
  root: string;
  iconWrap: string;
  iconSize: number;
  title: string;
  description: string;
  button: string;
  actionIconSize: number;
}> = {
  compact: {
    root: 'py-12 gap-5 px-6',
    iconWrap: 'rounded-2xl bg-[var(--primary)]/10 p-4 text-[var(--primary)]',
    iconSize: 28,
    title: 'text-sm font-bold text-text-main',
    description: 'mt-1 text-sm text-zinc-500',
    button: 'px-5 py-2.5 text-xs',
    actionIconSize: 13,
  },
  default: {
    root: 'py-12 gap-6 px-6',
    iconWrap: 'rounded-2xl bg-[var(--primary)]/10 p-5 text-[var(--primary)]',
    iconSize: 32,
    title: 'text-base font-bold text-text-main',
    description: 'mt-1 text-sm text-zinc-500',
    button: 'px-6 py-3 text-sm',
    actionIconSize: 16,
  },
};

export const EmptyGenerationState: React.FC<EmptyGenerationStateProps> = ({
  icon: Icon = Sparkles,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  actionDisabled = false,
  disabledReason,
}) => {
  const styles = emptyVariantStyles[variant];

  return (
    <div className={cn('flex flex-col items-center justify-center text-center', styles.root)}>
      <div className={styles.iconWrap}>
        <Icon size={styles.iconSize} />
      </div>
      <div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>
      <button
        onClick={onAction}
        disabled={actionDisabled}
        title={actionDisabled ? disabledReason : undefined}
        className={cn(
          'flex items-center gap-2 rounded-xl bg-[var(--primary)] font-bold text-white shadow-lg hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50',
          styles.button,
        )}
      >
        <Sparkles size={styles.actionIconSize} />
        {actionLabel}
      </button>
    </div>
  );
};

interface GenerationFailedStateProps {
  message: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
  disabledReason?: string;
}

export const GenerationFailedState: React.FC<GenerationFailedStateProps> = ({
  message,
  onRetry,
  retryDisabled = false,
  disabledReason,
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center gap-5 px-6">
    <div className="rounded-2xl bg-red-500/10 p-4 text-red-500">
      <AlertCircle size={28} />
    </div>
    <div>
      <h3 className="text-sm font-bold text-text-main">Generation Failed</h3>
      <p className="mt-1 text-[11px] text-zinc-400 max-w-[220px]">{message}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        disabled={retryDisabled}
        title={retryDisabled ? disabledReason : undefined}
        className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw size={13} />
        Retry
      </button>
    )}
  </div>
);
