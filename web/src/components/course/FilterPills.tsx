import React from 'react';
import { cn } from '../../utils/cn';

export interface FilterPillOption<K extends string> {
  key: K;
  label: string;
  /** Classes applied when this pill is the active filter (e.g. 'bg-red-500 text-white'). */
  activeClass: string;
}

/** The pill-row filter used in the artifact section headers. */
export function FilterPills<K extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly FilterPillOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(({ key, label, activeClass }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'rounded-full px-3 py-0.5 text-xs font-semibold capitalize transition-colors',
            value === key
              ? activeClass
              : 'border border-[var(--border-color)] bg-[var(--bg-app)] text-text-muted hover:text-text-main',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
