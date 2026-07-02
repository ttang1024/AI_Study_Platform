import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, Target } from 'lucide-react';
import { cn } from '../utils/cn';
import { AnalyticsSection } from '../components/dashboard/AnalyticsSection';
import { ReinforcementPanel } from '../components/reinforcement/ReinforcementPanel';

type Tab = 'analytics' | 'reinforcement';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'reinforcement', label: 'Reinforcement', icon: Target },
];

export const InsightsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');

  // Practice graduated to its own top-level page. Old deep links (dashboard
  // bookmarks, cached recommendation URLs) still arrive here — forward them.
  if (param === 'practice') {
    const smart = searchParams.get('smart');
    return <Navigate to={`/practice${smart ? `?smart=${smart}` : ''}`} replace />;
  }

  const activeTab: Tab = param === 'reinforcement' ? 'reinforcement' : 'analytics';

  const selectTab = (tab: Tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'analytics') next.delete('tab');
    else next.set('tab', tab);
    if (tab !== 'reinforcement') next.delete('module');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
          Your <span className="text-[var(--primary)]">Insights</span>
        </h1>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-[var(--border-color)]">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'text-[var(--primary)]' : 'text-text-muted hover:text-text-main',
              )}
            >
              <tab.icon size={16} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="insights-tab-underline"
                  className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-[var(--primary)]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'analytics' && <AnalyticsSection />}
          {activeTab === 'reinforcement' && <ReinforcementPanel />}
        </motion.div>
      </AnimatePresence>

    </div>
  );
};
