import React from 'react';
import { cn } from '../../utils/cn';

/** The red inline banner every admin page shows when a load or save fails. */
export const ErrorBanner: React.FC<{ error?: string | null; className?: string }> = ({ error, className }) => {
  if (!error) return null;
  return (
    <div className={cn(
      'mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600',
      className,
    )}>
      {error}
    </div>
  );
};
