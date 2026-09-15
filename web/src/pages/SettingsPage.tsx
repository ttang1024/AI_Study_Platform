import React from 'react';
import { useLocation } from 'react-router-dom';
import { User, Shield, LogOut, KeyRound, Archive, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { useTabParam } from '../components/common/PageTabs';
import { ProfileTab } from '../components/settings/ProfileTab';
import { SecurityTab } from '../components/settings/SecurityTab';
import { AiServicesTab } from '../components/settings/AiServicesTab';
import { AiUsageTab } from '../components/settings/AiUsageTab';
import { VoiceTab } from '../components/settings/VoiceTab';
import { ExportTab } from '../components/settings/ExportTab';
import { DataRightsSection } from '../components/settings/DataRightsSection';

type SettingsTab = 'profile' | 'security' | 'ai' | 'ai-usage' | 'export';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'ai', label: 'AI Services', icon: KeyRound },
  // Sits next to AI Services on purpose: the keys are configured there, and this is what they cost.
  { id: 'ai-usage', label: 'AI Usage', icon: Activity },
  { id: 'export', label: 'Export', icon: Archive },
] as const;

const TAB_IDS = tabs.map(t => t.id) as readonly SettingsTab[];

export const SettingsPage: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  // The tab is in the URL, but callers that push a tab through router state — the AI-provider
  // banner — still work.
  const stateTab = (location.state as { activeTab?: SettingsTab } | null)?.activeTab;
  const { active: activeTab, select: setActiveTab } = useTabParam(TAB_IDS, stateTab ?? 'profile');

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-text-main">Settings</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-[var(--primary)] text-white shadow-md"
                  : "text-text-muted hover:bg-[var(--bg-sidebar)] hover:text-text-main"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
          <div className="pt-4 mt-4 border-t border-[var(--border-color)]">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[var(--bg-sidebar)] rounded-2xl border border-[var(--border-color)] p-8 shadow-sm">
          {activeTab === 'profile' && (
            <>
              <ProfileTab />
              <div className="mt-10 border-t border-[var(--border-color)] pt-10"><VoiceTab /></div>
            </>
          )}
          {activeTab === 'security' && (
            <>
              <SecurityTab />
              <div className="mt-10 border-t border-[var(--border-color)] pt-10"><DataRightsSection /></div>
            </>
          )}
          {activeTab === 'ai' && <AiServicesTab />}
          {activeTab === 'ai-usage' && <AiUsageTab />}
          {activeTab === 'export' && <ExportTab />}
        </div>
      </div>
    </div>
  );
};
