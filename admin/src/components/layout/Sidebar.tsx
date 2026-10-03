import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, LogOut, ShieldCheck, Users, BarChart3, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/feedback', icon: MessageSquare, label: 'Feedback' },
];

interface SidebarProps {
  className?: string;
  /**
   * Set when the sidebar is rendered inside the mobile drawer: it adds a close
   * button and dismisses the drawer whenever a nav item is tapped.
   */
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className, onClose }) => {
  const { email, logout } = useAuth();

  return (
    <aside
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)]',
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-[var(--border-color)] px-5 py-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
          <ShieldCheck size={16} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">Admin Panel</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Study Platform</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--text-primary)]"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-emerald-600/10 text-emerald-700'
                : 'text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text-primary)]',
            )}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border-color)] px-3 py-4">
        <div className="mb-2 px-3 py-1">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{email}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Administrator</p>
        </div>
        <button
          onClick={logout}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-red-600"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
};
