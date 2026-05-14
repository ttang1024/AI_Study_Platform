import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'xs';
  className?: string;
  selectClassName?: string;
}

export const Select: React.FC<SelectProps> = ({ size = 'sm', className, selectClassName, children, ...props }) => {
  return (
    <div className={cn('relative inline-block', className)}>
      <select
        className={cn(
          'w-full appearance-none cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-text-main outline-none transition-colors',
          'pr-8 focus:border-primary focus:ring-2 focus:ring-primary/10',
          size === 'xs' ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          selectClassName
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
};
