import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { User, Shield, LogOut, Save, Eye, EyeOff, Info, ShieldAlert, CheckCircle2, KeyRound, Wifi, Volume2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { cn } from '../utils/cn';
import { aiSettingsService, DEFAULT_MODELS, type AIProvider, type AISettings } from '../services/aiSettingsService';
import { apiClient } from '../services/apiClient';
import { ttsSettingsService, type TtsSettings } from '../services/ttsSettingsService';

const PROVIDER_ICON_SRC: Partial<Record<AIProvider, string>> = {
  gemini: '/images/gemini.png',
  openai: '/images/openai.svg',
  claude: '/images/claude.ico',
  deepseek: '/images/deepseek.png',
  grok: '/images/grok.ico',
  kimi: '/images/moonshot.ico',
  doubao: '/images/doubao.png',
  qwen: '/images/qwen.png',
  wenxin: '/images/yiyan.ico',
};

// ── Brand icons ──────────────────────────────────────────────────────────────
function ProviderIcon({ id, size = 22 }: { id: AIProvider; size?: number }) {
  const src = PROVIDER_ICON_SRC[id];
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  switch (id) {
    case 'gemini':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="gem-g" x1="2" y1="2" x2="22" y2="22">
              <stop stopColor="#4285F4" />
              <stop offset="1" stopColor="#34A853" />
            </linearGradient>
          </defs>
          <path d="M12 2C12 7.523 7.523 12 2 12C7.523 12 12 16.477 12 22C12 16.477 16.477 12 22 12C16.477 12 12 7.523 12 2Z" fill="url(#gem-g)" />
        </svg>
      );
    case 'openai':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#10A37F">
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.004 14.2a4.501 4.501 0 0 1-1.664-6.304zm16.55 3.866l-5.843-3.371 2.02-1.163a.08.08 0 0 1 .07 0l4.81 2.771a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.381-.664zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.814-2.772a4.5 4.5 0 0 1 6.679 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
      );
    case 'claude':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#D97757">
          <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-1.07-.121L2 12.561l.146-.327.534-.245 1.56.097 2.217.17 1.755.17h.389l.012-.036-.62-.352-1.962-1.08-2.339-1.312-1.096-.679-.705-.461-.158-.327.067-.388.456-.255.547.097 1.316.777 2.155 1.288 1.706 1.068.388.231.048-.073-.243-.619-.754-2.02-.547-1.457-.401-1.288-.036-.388.146-.34.547-.146.668.146.486.827.851 2.325.547 1.603.315.942.085-.036V5.457l.061-1.603.11-1.288.158-.754.401-.485.522-.158.456.146.261.376-.036.827-.146 1.688-.109 2.166v.9l.073-.012 1.56-2.865.961-1.567.802-1.2.547-.619.729-.28.607.158.158.485-.182.547-1.135 1.925-1.135 2.008-.547 1.019.036.048 1.962-1.949 1.56-1.421 1.244-1.019.985-.559.802.097.34.388-.146.522-1.925 2.02-1.682 1.949-.146.17.012.024 2.411-.923 1.925-.619 1.56-.34.985-.012.547.34.073.607-.522.388-1.56.461-2.29.754-1.974.777-.146.061.012.036 1.949.146 1.949.243 1.032.243.583.303.34.559-.34.571-.802.109-2.411-.376-1.925-.315h-.34l.024.061 1.56 1.056 1.925 1.397 1.14.948.34.619-.28.656-.729.085-.948-.461-1.949-1.531-1.56-1.275-.17-.122-.024.049.315.79 1.019 2.532.413 1.14.267 1.019v.619l-.34.486-.583.073-.547-.34-.729-1.603-.729-2.117-.461-1.312-.146-.34h-.049l-.048 1.019-.17 2.532-.243 1.603-.267.948-.461.413-.583-.073-.401-.461.061-.777.413-2.532.146-2.033-.012-.146-.061.073-1.019 1.682-1.56 2.411-.948 1.208-.765.656-.802.085-.522-.34-.036-.583.34-.656 1.032-1.56 1.56-2.411.413-.729-.012-.036-1.56.923-2.411 1.312-1.56.729-.948.243-.583-.243-.267-.583.34-.583.729-.267 2.532-1.068 1.56-.631.34-.17v-.049l-2.411.097-1.949.061-1.14-.073-.656-.267-.267-.656.34-.583.729-.158 1.949.17 2.411.243 1.56.073.389.012v-.012l-.017-.024z" />
        </svg>
      );
    case 'kimi':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="kimi-g" x1="2" y1="2" x2="22" y2="22">
              <stop stopColor="#6C63FF" />
              <stop offset="1" stopColor="#3ECFCF" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="url(#kimi-g)" />
          <path d="M8 8h2v8H8zM14 8l-3 4 3 4h2.5l-3-4 3-4H14z" fill="white" />
        </svg>
      );
    case 'doubao':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="doubao-g" x1="2" y1="2" x2="22" y2="22">
              <stop stopColor="#1664FF" />
              <stop offset="1" stopColor="#4FACFE" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#doubao-g)" />
          <path d="M7 9.5C7 8.67 7.67 8 8.5 8h4C13.88 8 15 9.12 15 10.5S13.88 13 12.5 13H9v3H7V9.5zm2 1.5v1.5h3a.75.75 0 0 0 0-1.5H9z" fill="white" />
        </svg>
      );
    case 'deepseek':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#4D6BFE">
          <path d="M2.557 9.297c.056-.252.14-.498.249-.733C4.123 5.64 7.078 3.914 11.04 4.003c1.657.038 2.898.535 3.913 1.29a6.77 6.77 0 0 1 .635.574c.32-.122.65-.208.986-.257 1.06-.154 2.02.124 2.73.764.724.653.99 1.635.88 2.52a4.03 4.03 0 0 1-.255 1.019c.34.434.59.938.72 1.49.28 1.175-.002 2.44-.81 3.378-.82.95-2.08 1.484-3.67 1.373a7.1 7.1 0 0 1-1.075-.17c-.485.46-1.066.82-1.757 1.038a6.41 6.41 0 0 1-4.003-.048c-.9-.31-1.682-.87-2.253-1.61-.6.05-1.22-.012-1.81-.2-1.075-.34-1.953-1.104-2.4-2.12a4.46 4.46 0 0 1-.313-2.747zm9.576 6.97c.378-.116.726-.303 1.025-.556a7.47 7.47 0 0 1-1.595-.64c-1.22-.7-2.206-1.767-2.74-3.044-.54-1.29-.556-2.73-.038-4.045a7.1 7.1 0 0 1 .54-1.074c-.84.072-1.624.366-2.28.876-.956.752-1.476 1.87-1.476 3.13 0 .6.134 1.167.378 1.67.37.77 1.004 1.38 1.806 1.668.6.214 1.24.263 1.872.157l.1-.018.064.08c.515.643 1.224 1.1 2.02 1.35a5.1 5.1 0 0 0 .324.045zm2.527-1.296c1.27.067 2.224-.323 2.822-1.014.55-.635.762-1.568.557-2.44a3.28 3.28 0 0 0-.673-1.324l-.097-.114.07-.134c.2-.384.31-.804.318-1.233.017-.556-.16-1.048-.504-1.36-.358-.323-.897-.453-1.554-.356a3.6 3.6 0 0 0-.77.206l-.138.054-.1-.11a6.05 6.05 0 0 0-.616-.554c-.846-.642-1.875-1.054-3.26-1.087-3.25-.076-5.698 1.29-6.78 3.6a4.07 4.07 0 0 0-.227.673c.015-.006.028-.012.042-.016 1.117-3.013 3.888-4.08 6.587-3.606.933.163 1.698.52 2.268 1.035a3.8 3.8 0 0 1 .437.508c.12-.02.24-.033.362-.04 1.02-.06 1.937.25 2.567.907.622.65.875 1.59.758 2.564a4.77 4.77 0 0 1-.4 1.318c.23.386.38.82.437 1.28.12.965-.106 1.993-.793 2.752a4.08 4.08 0 0 1-.68.594z" />
        </svg>
      );
    case 'grok':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.545 2L8 12.5 13.545 22h2.91L10.91 12.5 16.455 2z" fill="#000" />
          <path d="M10.455 2L4.91 12.5 10.455 22h2.91L7.82 12.5 13.364 2z" fill="#333" opacity="0.5" />
        </svg>
      );
    case 'qwen':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="qwen-g" x1="2" y1="2" x2="22" y2="22">
              <stop stopColor="#6B4FBB" />
              <stop offset="1" stopColor="#9B59B6" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#qwen-g)" />
          <path d="M12 5.5a6.5 6.5 0 1 0 4.243 11.243L18 18.5l-1.5-1.5A6.5 6.5 0 0 0 12 5.5zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" fill="white" />
        </svg>
      );
    case 'wenxin':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="wenxin-g" x1="2" y1="2" x2="22" y2="22">
              <stop stopColor="#2563EB" />
              <stop offset="0.5" stopColor="#3B82F6" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#wenxin-g)" />
          <path d="M7 7.5C7 7.5 9.5 6 12 6C14.5 6 17 7.5 17 10C17 12 15.5 13.5 13.5 14L15 18H12.5L11 14.5H9.5V18H7V7.5Z" fill="white" />
          <path d="M9.5 9V12.5H11.5C12.88 12.5 13.5 11.8 13.5 10.75C13.5 9.7 12.88 9 11.5 9H9.5Z" fill="url(#wenxin-g)" />
        </svg>
      );
  }
}

export const SettingsPage: React.FC = () => {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'ai' | 'voice'>(
    (location.state as any)?.activeTab ?? 'profile'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Profile states
  const [name, setName] = useState(user?.name ?? '');

  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState(false);

  // Voice / TTS settings
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(() => ttsSettingsService.load());
  const [showTtsKey, setShowTtsKey] = useState(false);
  const [ttsSuccess, setTtsSuccess] = useState(false);

  // AI Settings states
  const [aiSettings, setAISettings] = useState<AISettings>(() => aiSettingsService.load());
  const [viewedProvider, setViewedProvider] = useState<AIProvider>(() => aiSettingsService.load().provider);
  const [showAIKey, setShowAIKey] = useState(false);
  const [aiSuccess, setAISuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const validatePassword = (pass: string) => {
    if (pass.length < 8 || pass.length > 20) return false;
    let types = 0;
    if (/[A-Z]/.test(pass)) types++;
    if (/[a-z]/.test(pass)) types++;
    if (/[0-9]/.test(pass)) types++;
    if (/[^A-Za-z0-9]/.test(pass)) types++;
    return types >= 3;
  };

  const handleSave = async () => {
    if (activeTab === 'profile') {
      setProfileError(null);
      setProfileSuccess(false);
      if (!name.trim()) {
        setProfileError('Name cannot be empty.');
        return;
      }
      setIsSaving(true);
      try {
        await updateProfile({ fullName: name.trim() });
        setProfileSuccess(true);
      } catch (err: any) {
        setProfileError(err?.response?.data?.message || 'Failed to update profile. Please try again.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (activeTab === 'security') {
      setSecurityError(null);
      setSecuritySuccess(false);
      if (!currentPassword) {
        setSecurityError('Please enter your current password.');
        return;
      }
      if (!newPassword) {
        setSecurityError('Please enter a new password.');
        return;
      }
      if (!validatePassword(newPassword)) {
        setSecurityError('New password must be 8-20 characters long and include at least 3 types: uppercase, lowercase, numbers, or symbols.');
        return;
      }
      setIsSaving(true);
      try {
        await changePassword({ currentPassword, newPassword });
        setSecuritySuccess(true);
        setCurrentPassword('');
        setNewPassword('');
      } catch (err: any) {
        setSecurityError(err?.response?.data?.message || 'Failed to change password. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }

    if (activeTab === 'ai') {
      aiSettingsService.save(aiSettings);
      setAISuccess(true);
      setTimeout(() => setAISuccess(false), 3000);
    }

    if (activeTab === 'voice') {
      ttsSettingsService.save(ttsSettings);
      setTtsSuccess(true);
      setTimeout(() => setTtsSuccess(false), 3000);
    }
  };

  const handleTestConnection = async () => {
    const key = aiSettings.keys[viewedProvider]?.trim();
    if (!key) {
      setTestResult({ ok: false, message: 'No API key entered' });
      return;
    }
    const model = aiSettings.models?.[viewedProvider]?.trim() || DEFAULT_MODELS[viewedProvider];

    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await apiClient.get<{ data: string }>('/api/ai/test-provider', {
        headers: {
          'X-AI-Provider': viewedProvider,
          'X-AI-Key': key,
          'X-AI-Model': model,
        },
      });
      setTestResult({ ok: true, message: `Connected — response: "${res.data.data}"` });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Connection failed';
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestingConnection(false);
    }
  };

  const AI_PROVIDERS: { id: AIProvider; label: string; shortLabel: string; placeholder: string; docsHint: string; badge?: string }[] = [
    { id: 'gemini', label: 'Google Gemini', shortLabel: 'Gemini', placeholder: 'AIza...', docsHint: 'aistudio.google.com' },
    { id: 'openai', label: 'OpenAI', shortLabel: 'OpenAI', placeholder: 'sk-...', docsHint: 'platform.openai.com' },
    { id: 'claude', label: 'Anthropic Claude', shortLabel: 'Claude', placeholder: 'sk-ant-...', docsHint: 'console.anthropic.com' },
    { id: 'grok', label: 'xAI Grok', shortLabel: 'Grok', placeholder: 'xai-...', docsHint: 'console.x.ai' },
    { id: 'deepseek', label: 'DeepSeek', shortLabel: 'DeepSeek', placeholder: 'sk-...', docsHint: 'platform.deepseek.com', badge: 'Low cost' },
    { id: 'kimi', label: 'Kimi AI', shortLabel: 'Kimi', placeholder: 'sk-...', docsHint: 'platform.moonshot.cn' },
    { id: 'doubao', label: 'Doubao', shortLabel: 'Doubao', placeholder: 'your-doubao-key', docsHint: 'console.volcengine.com' },
    { id: 'qwen', label: 'Alibaba Qwen', shortLabel: 'Qwen', placeholder: 'sk-...', docsHint: 'dashscope.aliyuncs.com' },
    { id: 'wenxin', label: 'Wenxin Yiyan', shortLabel: 'Wenxin', placeholder: 'bce-v3/ALXXXXXXXXXX/...', docsHint: 'console.bce.baidu.com/qianfan' },
  ];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'ai', label: 'AI Services', icon: KeyRound },
    { id: 'voice', label: 'Voice', icon: Volume2 },
  ];

  const newPasswordValid = validatePassword(newPassword);

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
              onClick={() => setActiveTab(tab.id as any)}
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
            <div className="space-y-8">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="h-24 w-24 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] border-2 border-[var(--border-color)]">
                    <User size={40} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main">{user?.name}</h3>
                  <p className="text-sm text-text-muted">{user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-main">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setProfileSuccess(false); }}
                    className="w-full px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-text-main outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-main">Email Address</label>
                  <input
                    type="email"
                    defaultValue={user?.email}
                    disabled
                    className="w-full px-4 py-2 rounded-xl border border-[var(--border-color)] bg-zinc-50 text-text-muted outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {profileError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
                  <ShieldAlert size={14} />
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 border border-emerald-100">
                  <CheckCircle2 size={14} />
                  Profile updated successfully.
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-text-main">Security Settings</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-main">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 pr-12 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-text-main outline-none focus:border-[var(--primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-main">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={cn(
                        "w-full px-4 py-2 pr-12 rounded-xl border outline-none transition-all",
                        newPassword && (newPasswordValid ? "border-emerald-200 bg-emerald-50 focus:border-emerald-500" : "border-red-200 bg-red-50 focus:border-red-500"),
                        !newPassword && "border-[var(--border-color)] bg-[var(--bg-app)] focus:border-[var(--primary)]"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <Info size={14} className="mt-0.5 text-primary shrink-0" />
                    <p className="text-[10px] leading-relaxed text-zinc-500">
                      Password must be 8-20 characters long and include at least 3 types:
                      uppercase letters, lowercase letters, numbers, or symbols.
                    </p>
                  </div>
                </div>

                {securityError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
                    <ShieldAlert size={14} />
                    {securityError}
                  </div>
                )}
                {securitySuccess && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 border border-emerald-100">
                    <CheckCircle2 size={14} />
                    Password changed successfully.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ai' && (() => {
            const viewed = AI_PROVIDERS.find(p => p.id === viewedProvider)!;
            return (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-text-main">AI Services</h3>
                  <p className="text-sm text-text-muted mt-1">
                    Keys are stored locally on your device and never sent to our servers.
                  </p>
                </div>

                {/* Provider tabs */}
                <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                  {AI_PROVIDERS.map((p) => {
                    const isViewed = viewedProvider === p.id;
                    const isActive = aiSettings.provider === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setViewedProvider(p.id); setShowAIKey(false); setTestResult(null); }}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border text-xs font-medium transition-all shrink-0",
                          isViewed
                            ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                            : "border-[var(--border-color)] text-text-muted hover:border-[var(--primary)]/40 hover:text-text-main"
                        )}
                      >
                        <ProviderIcon id={p.id} size={22} />
                        <span>{p.shortLabel}</span>
                        {/* active-provider dot */}
                        {isActive && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" title="Active provider" />
                        )}
                        {/* configured dot (when not active) */}
                        {!isActive && aiSettings.keys[p.id] && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-zinc-300" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ProviderIcon id={viewedProvider} size={20} />
                      <span className="font-semibold text-text-main">{viewed.label}</span>
                      {viewed.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] font-semibold">
                          {viewed.badge}
                        </span>
                      )}
                    </div>
                    {aiSettings.provider !== viewedProvider ? (
                      <button
                        type="button"
                        onClick={() => { setAISettings(s => ({ ...s, provider: viewedProvider })); setAISuccess(false); }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-all"
                      >
                        Set as active
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Active provider
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-main">API Key</label>
                    <div className="relative">
                      <input
                        type={showAIKey ? 'text' : 'password'}
                        value={aiSettings.keys[viewedProvider] ?? ''}
                        onChange={(e) => {
                          setAISuccess(false);
                          setAISettings(s => ({ ...s, keys: { ...s.keys, [viewedProvider]: e.target.value } }));
                        }}
                        placeholder={viewed.placeholder}
                        className="w-full px-4 py-2.5 pr-12 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-text-main outline-none focus:border-[var(--primary)] font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAIKey(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                      >
                        {showAIKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-text-muted">Get your key at {viewed.docsHint}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-main">Model</label>
                    <input
                      type="text"
                      value={aiSettings.models?.[viewedProvider] ?? DEFAULT_MODELS[viewedProvider]}
                      onChange={(e) => {
                        setAISuccess(false);
                        setAISettings(s => ({ ...s, models: { ...s.models, [viewedProvider]: e.target.value } }));
                      }}
                      placeholder={DEFAULT_MODELS[viewedProvider]}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-text-main outline-none focus:border-[var(--primary)] font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Test connection */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection || !aiSettings.keys[viewedProvider]}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm font-medium text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Wifi size={15} />
                    {testingConnection ? 'Testing…' : 'Test Connection'}
                  </button>
                  {testResult && (
                    <span className={cn('text-xs font-medium', testResult.ok ? 'text-emerald-600' : 'text-red-500')}>
                      {testResult.ok ? '✓' : '✗'} {testResult.message}
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                  <Info size={14} className="mt-0.5 text-[var(--primary)] shrink-0" />
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    The green dot marks your active provider used for all AI requests. A grey dot means a key is configured but not active.
                  </p>
                </div>

                {aiSuccess && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 border border-emerald-100">
                    <CheckCircle2 size={14} />
                    AI settings saved successfully.
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-text-main">Voice Synthesis</h3>
                <p className="text-sm text-text-muted mt-1">
                  Uses Hume AI for expressive, natural-sounding TTS. Keys are stored locally and never sent to our servers.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-main">Hume API Key</label>
                  <div className="relative">
                    <input
                      type={showTtsKey ? 'text' : 'password'}
                      value={ttsSettings.humeApiKey}
                      onChange={(e) => { setTtsSuccess(false); setTtsSettings(s => ({ ...s, humeApiKey: e.target.value })); }}
                      placeholder="hume_..."
                      className="w-full px-4 py-2.5 pr-12 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-text-main outline-none focus:border-[var(--primary)] font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTtsKey(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
                    >
                      {showTtsKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-text-muted">Get your key at platform.hume.ai</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-main">Voice</label>
                  <input
                    type="text"
                    value={ttsSettings.voice}
                    onChange={(e) => { setTtsSuccess(false); setTtsSettings(s => ({ ...s, voice: e.target.value })); }}
                    placeholder="ITO"
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-text-main outline-none focus:border-[var(--primary)] font-mono text-sm"
                  />
                  <p className="text-[10px] text-text-muted">Hume AI voice name, e.g. ITO, KORA, DACHER, AURA, FINN, WHIMSY</p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <Info size={14} className="mt-0.5 text-[var(--primary)] shrink-0" />
                <p className="text-[10px] leading-relaxed text-zinc-500">
                  Without a key, playback falls back to the browser's built-in speech synthesis.
                </p>
              </div>

              {ttsSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 border border-emerald-100">
                  <CheckCircle2 size={14} />
                  Voice settings saved.
                </div>
              )}
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-[var(--border-color)] flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
