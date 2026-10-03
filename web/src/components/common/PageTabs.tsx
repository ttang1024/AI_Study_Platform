import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * The shared pieces behind every page that used to be several pages. A merged page keeps its own
 * header (the action row usually depends on which tab is showing), and composes:
 *
 *   const { active, select } = useTabParam(TABS.map(t => t.id), 'first');
 *   <PageTabBar … /> + <PageTabPanels … />
 *
 * Two rules the pages rely on:
 *  - the active tab lives in the query string, so a tab is deep-linkable, survives a reload, and
 *    lets the retired routes live on as plain redirects (`/planner` → `/quizzes?tab=planner`);
 *  - a panel is mounted on first visit and then only hidden. These tabs hold real work in progress
 *    — a half-uploaded file, a running mock exam, a filtered list, a settled graph simulation —
 *    and unmounting on every tab switch would throw it away and refetch.
 */

interface PageTabBase<T extends string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  /** One line under the page title, shown while this tab is active. */
  blurb?: string;
  /** Extra classes on the panel wrapper — for panels that need a height to lay out against. */
  panelClassName?: string;
}

/**
 * A panel is either a self-contained component (the usual case, and the only one that can be
 * `lazy`) or, for panels that need state the page already holds, an element built by the page.
 * An element is safe here because React reconciles by type and position, not identity — a panel
 * given as `content` re-renders on each parent render but is not remounted, so it keeps its state
 * like a `panel` one does.
 */
export type PageTab<T extends string> = PageTabBase<T> & (
  | { panel: React.ComponentType; content?: never }
  | { content: React.ReactNode; panel?: never }
);

interface UseTabParamOptions<T extends string> {
  /** Query-string key. Defaults to `tab`; override it when a panel already owns `tab` itself. */
  param?: string;
  /** Params that only make sense for certain tabs and should be dropped when leaving them. */
  clearOnLeave?: (tab: T) => readonly string[];
}

export function useTabParam<T extends string>(
  tabIds: readonly T[],
  fallback: T,
  { param = 'tab', clearOnLeave }: UseTabParamOptions<T> = {},
): { active: T; select: (tab: T) => void } {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(param);
  const active = (tabIds as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback;

  const select = useCallback((tab: T) => {
    const next = new URLSearchParams(searchParams);
    // The default tab is the bare URL, so /quizzes and /quizzes?tab=history are the same place.
    if (tab === fallback) next.delete(param);
    else next.set(param, tab);
    for (const key of clearOnLeave?.(tab) ?? []) next.delete(key);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, fallback, param, clearOnLeave]);

  return { active, select };
}

interface PageTabBarProps<T extends string> {
  /** Unique per page — namespaces the DOM ids and the sliding underline's layoutId. */
  idPrefix: string;
  ariaLabel: string;
  tabs: readonly PageTab<T>[];
  active: T;
  onSelect: (tab: T) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export function PageTabBar<T extends string>({
  idPrefix, ariaLabel, tabs, active, onSelect, variant = 'underline', className,
}: PageTabBarProps<T>) {
  const tabRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  // Arrow/Home/End moves between tabs, per the ARIA tabs pattern. Only the active tab is in the
  // page's tab order, so Tab from the tablist lands in the panel rather than on the next tab.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex(t => t.id === active);
    const next =
      e.key === 'ArrowRight' ? (i + 1) % tabs.length
      : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : null;
    if (next === null) return;
    e.preventDefault();
    const { id } = tabs[next];
    onSelect(id);
    tabRefs.current[id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        // `shrink-0`: `overflow-x-auto` makes this a scroll container, so inside a flex-column page
        // its automatic minimum size is 0 and it would be squashed flat whenever the panel below
        // overflows. A tab bar is never the thing that gives up height.
        'flex shrink-0 items-center overflow-x-auto no-scrollbar',
        variant === 'underline'
          ? 'gap-1 border-b border-[var(--border-color)]'
          : 'w-fit gap-1 rounded-xl bg-zinc-100 p-1',
        className,
      )}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            ref={el => { tabRefs.current[id] = el; }}
            role="tab"
            id={`${idPrefix}-tab-${id}`}
            aria-selected={isActive}
            aria-controls={`${idPrefix}-panel-${id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 whitespace-nowrap outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
              variant === 'underline'
                ? cn(
                    'rounded-t-[var(--radius)] px-4 py-2.5 text-sm font-medium',
                    isActive ? 'text-[var(--primary)]' : 'text-text-muted hover:text-text-main',
                  )
                : cn(
                    'rounded-lg px-4 py-2 text-sm font-bold',
                    isActive ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main',
                  ),
            )}
          >
            {Icon && <Icon size={16} />}
            {label}
            {isActive && variant === 'underline' && (
              <motion.div
                layoutId={`${idPrefix}-tab-underline`}
                className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-[var(--primary)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

const PanelFallback: React.FC = () => (
  <div className="flex items-center justify-center py-20 text-text-muted">
    <Loader2 size={20} className="animate-spin" />
  </div>
);

export function PageTabPanels<T extends string>({
  idPrefix, tabs, active,
}: { idPrefix: string; tabs: readonly PageTab<T>[]; active: T }) {
  const [visited, setVisited] = useState<Set<T>>(() => new Set<T>([active]));

  // Tracked here rather than in the click handler so a tab reached by URL (a redirect, a
  // bookmark, the back button) mounts the same way a clicked one does.
  useEffect(() => {
    setVisited(prev => (prev.has(active) ? prev : new Set(prev).add(active)));
  }, [active]);

  return (
    <>
      {tabs.map(tab => {
        if (!visited.has(tab.id)) return null;
        const Panel = tab.panel;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${idPrefix}-panel-${tab.id}`}
            aria-labelledby={`${idPrefix}-tab-${tab.id}`}
            hidden={active !== tab.id}
            // `hidden` alone loses to any display utility a panel's own wrapper sets.
            className={cn(tab.panelClassName, active !== tab.id && 'hidden')}
          >
            {/* Panels may be lazy — a tab shouldn't drag its chunk into the page's. */}
            <Suspense fallback={<PanelFallback />}>
              {Panel ? <Panel /> : tab.content}
            </Suspense>
          </div>
        );
      })}
    </>
  );
}

/**
 * Cross-fades the one-line blurb under a merged page's title as tabs change. No reserved second
 * line: every blurb is kept short enough to fit one line at this width, so the tab bar doesn't
 * shift on a tab switch and the title doesn't sit on 20px of empty space the rest of the time.
 */
export const PageTabBlurb: React.FC<{ tabKey: string; children: React.ReactNode }> = ({ tabKey, children }) => (
  <motion.p
    key={tabKey}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.18 }}
    className="text-sm text-text-muted mt-1 max-w-2xl"
  >
    {children}
  </motion.p>
);
