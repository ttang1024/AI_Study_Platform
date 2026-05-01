import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, LogOut, ShieldCheck, Users } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/feedback', icon: MessageSquare, label: 'Feedback' },
];

export const Sidebar: React.FC = () => {
  const { email, logout } = useAuth();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-[var(--border-color)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <ShieldCheck size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">Admin Panel</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Study Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-indigo-600/15 text-indigo-400'
                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]',
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
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-white/5 hover:text-red-400 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
};
