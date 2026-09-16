import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, ShieldCheck } from 'lucide-react';
import { Sidebar } from './Sidebar';

/**
 * Two-column shell on desktop. Below `lg` the sidebar collapses into an
 * off-canvas drawer opened from a sticky top bar, so the content column keeps
 * the full viewport width on phones and small tablets.
 */
export const AdminLayout: React.FC = () => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the drawer on navigation and on Escape.
  useEffect(() => setIsNavOpen(false), [pathname]);

  useEffect(() => {
    if (!isNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isNavOpen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Permanent sidebar (lg and up) */}
      <Sidebar className="hidden lg:flex" />

      {/* Off-canvas drawer (below lg) */}
      {isNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 animate-admin-fade-in"
            onClick={() => setIsNavOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 animate-admin-slide-in" role="dialog" aria-modal="true" aria-label="Navigation">
            <Sidebar onClose={() => setIsNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2.5 lg:hidden">
          <button
            type="button"
            onClick={() => setIsNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={isNavOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--text-primary)]"
          >
            <Menu size={20} />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <p className="truncate text-sm font-bold text-[var(--text-primary)]">Admin Panel</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[var(--bg-app)]">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
