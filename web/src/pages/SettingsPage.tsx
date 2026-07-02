import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { User, Shield, LogOut, KeyRound, Volume2, Archive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { ProfileTab } from '../components/settings/ProfileTab';
import { SecurityTab } from '../components/settings/SecurityTab';
import { AiServicesTab } from '../components/settings/AiServicesTab';
import { VoiceTab } from '../components/settings/VoiceTab';
import { ExportTab } from '../components/settings/ExportTab';

type SettingsTab = 'profile' | 'security' | 'ai' | 'voice' | 'export';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'ai', label: 'AI Services', icon: KeyRound },
  { id: 'voice', label: 'Voice', icon: Volume2 },
  { id: 'export', label: 'Export', icon: Archive },
] as const;

export const SettingsPage: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (location.state as any)?.activeTab ?? 'profile'
  );

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
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'ai' && <AiServicesTab />}
          {activeTab === 'voice' && <VoiceTab />}
          {activeTab === 'export' && <ExportTab />}
        </div>
      </div>
    </div>
  );
};
