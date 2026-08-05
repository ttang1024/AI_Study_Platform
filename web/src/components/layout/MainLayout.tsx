import React, { Suspense, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Menu, Search } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { cn } from '../../utils/cn';
import { OfflineBanner } from '../common/OfflineBanner';
import { AIProviderBanner } from '../common/AIProviderBanner';
import { GlobalSearch } from '../common/GlobalSearch';
import { ShortcutsModal } from '../common/ShortcutsModal';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

export const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const navigate = useNavigate();

  useKeyboardShortcuts([
    { key: 'k', meta: true, description: 'Command palette', action: () => setIsSearchOpen(v => !v) },
    { key: '/', description: 'Open search', action: () => setIsSearchOpen(true) },
    { key: '?', description: 'Show shortcuts', action: () => setIsShortcutsOpen(true) },
    { key: 'd', description: 'Dashboard', action: () => navigate('/dashboard') },
    { key: 'l', description: 'Library', action: () => navigate('/library') },
    { key: 'f', description: 'Flashcards', action: () => navigate('/flashcards') },
    { key: 'q', description: 'Practice Center', action: () => navigate('/quizzes') },
    { key: 'p', description: 'Practice', action: () => navigate('/quizzes?tab=practice') },
    { key: 'n', description: 'Notes', action: () => navigate('/materials') },
  ]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--bg-app)]">
      <OfflineBanner />
      <AIProviderBanner />
      {/* Atmospheric Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}
        />
        <motion.div
          animate={{ x: [0, -50, 0], y: [0, 100, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute top-[20%] -right-[10%] w-[35%] h-[35%] rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}
        />
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -50, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="absolute -bottom-[10%] left-[20%] w-[45%] h-[45%] rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
        />
      </div>

      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(v => !v)}
        onSearchOpen={() => setIsSearchOpen(true)}
      />

      <div className={cn(
        'relative z-10 flex flex-1 flex-col min-w-0 overflow-hidden transition-all duration-300',
        isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64',
      )}>
        {/* Mobile-only top bar */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 text-text-muted hover:bg-[var(--primary)]/10"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <img src="/app.png" alt="logo" className="h-7 w-7 rounded-lg object-cover" />
            <span className="logo-text bg-primary bg-clip-text text-transparent font-bold text-sm">
              Easy Study
            </span>
          </div>
          <NotificationBell />
          <button
            onClick={() => setIsSearchOpen(true)}
            className="rounded-lg p-2 text-text-muted hover:bg-[var(--primary)]/10"
          >
            <Search size={18} />
          </button>
        </div>

        {/* Desktop floating notification bell */}
        <div className="hidden lg:block absolute top-2 right-4 z-30">
          <NotificationBell className="bg-[var(--bg-sidebar)]/80 backdrop-blur shadow-sm border border-[var(--border-color)]" />
        </div>

        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          {/* Full-width scroll container so the scrollbar sits at the page's right
              edge; content stays centered via the inner max-width wrapper. */}
          <div id="main-scroll" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl h-full">
              {/* Pages are lazy-loaded; keep the shell visible while a chunk loads. */}
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
