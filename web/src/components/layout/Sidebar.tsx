import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Library, Settings, LogOut, BrainCircuit,
  Award, NotebookPen, X, Sparkles, ChevronLeft, ChevronRight,
  User, BookMarked, MessageSquarePlus,
  Search, Trophy, Users, Bot, Network, CloudDownload, LineChart,
} from 'lucide-react';
import { AchievementsPanel } from '../dashboard/AchievementsPanel';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
  onSearchOpen?: () => void;
}

const navItems = [
  { icon: Sparkles, label: 'AI Summarizer', path: '/summarizer' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: LineChart, label: 'Insights', path: '/insights' },
  { icon: Library, label: 'Library', path: '/library' },
  { icon: BrainCircuit, label: 'Flashcards', path: '/flashcards' },
  { icon: Award, label: 'Quizzes', path: '/quizzes' },
  { icon: BookMarked, label: 'Glossary', path: '/glossary' },
  { icon: NotebookPen, label: 'Notes', path: '/notes' },
  { icon: Bot, label: 'AI Chat', path: '/chat' },
  { icon: Network, label: 'Knowledge Graph', path: '/knowledge-graph' },
  { icon: Users, label: 'Study Groups', path: '/groups' },
  { icon: CloudDownload, label: 'Offline', path: '/offline' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isCollapsed, onToggle, onSearchOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null);

  const showTooltip = (e: React.MouseEvent, label: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ label, y: rect.top + rect.height / 2 });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-2xl lg:shadow-none transition-all duration-300',
        isCollapsed ? 'lg:w-16 w-64' : 'w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>

        {/* ── Logo area ── */}
        <style>{`
          @keyframes logoGradient {
            0%, 100% { background-position: 0% 50%; }
            50%       { background-position: 100% 50%; }
          }
          @keyframes logoGlow {
            0%, 100% { box-shadow: 0 4px 18px rgba(13,148,136,0.4); }
            50%       { box-shadow: 0 4px 28px rgba(20,184,166,0.55), 0 0 36px rgba(8,145,178,0.2); }
          }
          @keyframes logoTextFlow {
            0%   { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
        `}</style>
        <div className={cn(
          'flex h-20 shrink-0 items-center border-b border-[var(--border-color)]',
          isCollapsed ? 'justify-center' : 'justify-between px-5',
        )}>
          <div className="flex items-center gap-3">
            {/* Animated gradient icon box */}
            <motion.div
              whileHover={{ scale: 1.12, rotate: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 16 }}
              onClick={isCollapsed ? onToggle : undefined}
              className={cn(
                'p-0.5 relative h-10 w-10 shrink-0 rounded-xl overflow-hidden',
                isCollapsed && 'cursor-pointer',
              )}
              title={isCollapsed ? 'Expand sidebar' : undefined}
            >
              <img src="/app.png" alt="toto.ai logo" className="w-full h-full object-cover" />
            </motion.div>

            {!isCollapsed && (
              <span
                className="font-black text-xl select-none tracking-tight"
                style={{
                  background: 'linear-gradient(90deg, #059669, #14b8a6, #0891b2, #059669)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'logoTextFlow 3s linear infinite',
                }}
              >
                Easy Study
              </span>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex items-center gap-1">
              {/* Mobile close */}
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-text-muted hover:bg-[var(--primary)]/10 lg:hidden"
              >
                <X size={18} />
              </button>
              {/* Desktop collapse */}
              <button
                onClick={onToggle}
                className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-all"
                title="Collapse sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className={cn(
          'flex-1 space-y-1 overflow-y-auto py-4',
          isCollapsed ? 'px-2' : 'px-3',
        )}>
          {/* Search button */}
          {onSearchOpen && (
            <button
              onClick={onSearchOpen}
              onMouseEnter={(e) => isCollapsed && showTooltip(e, 'Search')}
              onMouseLeave={() => setTooltip(null)}
              className={cn(
                'group w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 text-text-muted hover:bg-zinc-100 hover:text-text-main mb-1',
                isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3',
              )}
            >
              <Search size={20} className="shrink-0 text-zinc-400 group-hover:text-primary transition-colors" />
              {!isCollapsed && (
                <span className="flex-1 text-left">Search</span>
              )}
              {!isCollapsed && (
                <kbd className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">/</kbd>
              )}
            </button>
          )}

          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                onMouseEnter={(e) => isCollapsed && showTooltip(e, item.label)}
                onMouseLeave={() => setTooltip(null)}
                className={cn(
                  'group relative flex items-center rounded-xl text-sm font-medium transition-all duration-200',
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3',
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/10'
                    : 'text-text-muted hover:bg-zinc-100 hover:text-text-main',
                )}
              >
                <item.icon size={20} className={cn(
                  'shrink-0 transition-transform group-hover:scale-110',
                  isActive ? 'text-white' : 'text-zinc-400 group-hover:text-primary',
                )} />
                {!isCollapsed && item.label}
                {isActive && !isCollapsed && (
                  <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-white/50" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Bottom section ── */}
        <div className={cn(
          'shrink-0 border-t border-[var(--border-color)] py-3 space-y-1',
          isCollapsed ? 'px-2' : 'px-3',
        )}>
          {/* Expand button (collapsed only) */}
          {isCollapsed && (
            <button
              onClick={onToggle}
              onMouseEnter={(e) => showTooltip(e, 'Expand sidebar')}
              onMouseLeave={() => setTooltip(null)}
              className="w-full flex justify-center p-3 rounded-xl text-text-muted hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-all"
            >
              <ChevronRight size={20} />
            </button>
          )}

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(v => !v)}
              onMouseEnter={(e) => isCollapsed && showTooltip(e, user?.name ?? 'Profile')}
              onMouseLeave={() => setTooltip(null)}
              className={cn(
                'group w-full flex items-center rounded-xl text-sm font-medium text-text-muted hover:bg-zinc-100 hover:text-text-main transition-all',
                isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3',
              )}
            >
              <div className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                <User size={15} />
              </div>
              {!isCollapsed && (
                <span className="truncate font-medium text-text-main">{user?.name}</span>
              )}
            </button>

            {isProfileOpen && (
              <div className={cn(
                'absolute bottom-full mb-2 z-50 w-56 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] p-2 shadow-xl animate-in fade-in zoom-in duration-200',
                isCollapsed ? 'left-full bottom-0 mb-0 ml-2' : 'left-0',
              )}>
                <div className="px-4 py-3 border-b border-[var(--border-color)] mb-1">
                  <p className="text-sm font-bold text-text-main truncate">{user?.name}</p>
                  <p className="text-xs text-text-muted truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setIsAchievementsOpen(true); setIsProfileOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-text-main hover:bg-amber-50 hover:text-amber-600 transition-all"
                >
                  <Trophy size={16} />
                  Achievements
                </button>
                <button
                  onClick={() => { navigate('/settings'); setIsProfileOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-text-main hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-all"
                >
                  <Settings size={16} />
                  Settings
                </button>
                <button
                  onClick={() => { navigate('/feedback'); setIsProfileOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-text-main hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-all"
                >
                  <MessageSquarePlus size={16} />
                  Feedback
                </button>
                <div className="my-1 border-t border-[var(--border-color)]" />
                <button
                  onClick={() => { logout(); setIsProfileOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-all"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Achievements modal */}
      {isAchievementsOpen && ReactDOM.createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsAchievementsOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-[9999] w-full max-w-lg flex flex-col bg-[var(--bg-sidebar)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4 shrink-0">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <h2 className="text-base font-bold text-text-main">Achievements</h2>
              </div>
              <button
                onClick={() => setIsAchievementsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted hover:bg-zinc-100 hover:text-text-main transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <AchievementsPanel />
            </div>
          </div>
        </>,
        document.body,
      )}

      {/* Portal tooltip — rendered outside aside to avoid overflow/transform clipping */}
      {isCollapsed && tooltip && ReactDOM.createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ top: tooltip.y, left: 68, transform: 'translateY(-50%)' }}
        >
          <div className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-xl whitespace-nowrap">
            {tooltip.label}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
