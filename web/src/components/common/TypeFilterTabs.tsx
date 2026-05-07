import React from 'react';
import { cn } from '../../utils/cn';

export interface TypeTab<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  count?: number;
}

interface TypeFilterTabsProps<T extends string = string> {
  tabs: TypeTab<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function TypeFilterTabs<T extends string = string>({
  tabs,
  active,
  onChange,
}: TypeFilterTabsProps<T>) {
  return (
    <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <div className="flex items-center gap-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-1.5 w-fit">
      {tabs.map(({ id, label, icon: Icon, count }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150',
              isActive
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'text-text-muted hover:text-text-main hover:bg-[var(--border-color)]',
            )}
          >
            {Icon && <Icon size={13} />}
            {label}
            {count !== undefined && (
              <span className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-bold',
                isActive ? 'bg-white/20 text-white' : 'bg-[var(--border-color)] text-text-muted',
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
    </div>
  );
}
