import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { User, Shield, LogOut, Save, Eye, EyeOff, Info, ShieldAlert, CheckCircle2, KeyRound, Wifi, Volume2, Download, Archive, FileText, Timer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudy } from '../context/StudyContext';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Select';
import { cn } from '../utils/cn';
import { aiSettingsService, DEFAULT_MODELS, type AIProvider, type AISettings } from '../services/aiSettingsService';
import { apiClient } from '../services/apiClient';
import { ttsSettingsService, type TtsSettings } from '../services/ttsSettingsService';
import { pomodoroSettings } from '../services/pomodoroSettings';
import { gamificationService } from '../services/gamificationService';
import { ProviderIcon } from '../components/settings/ProviderIcon';
import { useSettingsExport } from '../hooks/useSettingsExport';

export const SettingsPage: React.FC = () => {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const { allNotes } = useStudy();
  const { exporting, handleExport } = useSettingsExport();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'ai' | 'voice' | 'export'>(
    (location.state as any)?.activeTab ?? 'profile'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Profile states
  const [name, setName] = useState(user?.name ?? '');
  const [timerEnabled, setTimerEnabled] = useState(() => pomodoroSettings.isEnabled());

  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState(false);

  // Voice / TTS settings
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(() => ttsSettingsService.load());
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
    { id: 'export', label: 'Export', icon: Archive },
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

              <div className="border-t border-[var(--border-color)] pt-6">
                <h4 className="text-sm font-semibold text-text-main mb-3">Preferences</h4>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-[var(--primary)]/10 p-2 text-[var(--primary)]">
                      <Timer size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-main">Focus timer</p>
                      <p className="text-xs text-text-muted">Show the floating Pomodoro timer while you study.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={timerEnabled}
                    onClick={() => {
                      const next = !timerEnabled;
                      setTimerEnabled(next);
                      pomodoroSettings.setEnabled(next);
                    }}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40',
                      timerEnabled ? 'bg-[var(--primary)]' : 'bg-zinc-300',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                        timerEnabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
                      )}
                    />
                  </button>
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
                  Uses Microsoft Edge TTS for free, high-quality neural speech. No API key required.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-main">Voice</label>
                  <Select
                    value={ttsSettings.voice}
                    onChange={(e) => { setTtsSuccess(false); setTtsSettings(s => ({ ...s, voice: e.target.value })); }}
                    className="w-full"
                    selectClassName="px-4 py-2.5"
                  >
                    <optgroup label="English">
                      <option value="en-US-AriaNeural">Aria (US Female)</option>
                      <option value="en-US-GuyNeural">Guy (US Male)</option>
                      <option value="en-US-JennyNeural">Jenny (US Female)</option>
                      <option value="en-GB-SoniaNeural">Sonia (UK Female)</option>
                      <option value="en-GB-RyanNeural">Ryan (UK Male)</option>
                      <option value="en-AU-NatashaNeural">Natasha (AU Female)</option>
                    </optgroup>
                    <optgroup label="Chinese">
                      <option value="zh-CN-XiaoxiaoNeural">晓晓 (Mainland Female)</option>
                      <option value="zh-CN-YunxiNeural">云希 (Mainland Male)</option>
                      <option value="zh-CN-XiaoyiNeural">晓伊 (Mainland Female)</option>
                      <option value="zh-CN-YunyangNeural">云扬 (Mainland Male)</option>
                      <option value="zh-TW-HsiaoChenNeural">曉臻 (Taiwan Female)</option>
                      <option value="zh-HK-HiuGaaiNeural">曉佳 (HK Female)</option>
                    </optgroup>
                    <optgroup label="Japanese">
                      <option value="ja-JP-NanamiNeural">Nanami (JP Female)</option>
                      <option value="ja-JP-KeitaNeural">Keita (JP Male)</option>
                    </optgroup>
                    <optgroup label="Korean">
                      <option value="ko-KR-SunHiNeural">SunHi (KR Female)</option>
                      <option value="ko-KR-InJoonNeural">InJoon (KR Male)</option>
                    </optgroup>
                    <optgroup label="French">
                      <option value="fr-FR-DeniseNeural">Denise (FR Female)</option>
                      <option value="fr-FR-HenriNeural">Henri (FR Male)</option>
                    </optgroup>
                    <optgroup label="Spanish">
                      <option value="es-ES-ElviraNeural">Elvira (ES Female)</option>
                      <option value="es-MX-DaliaNeural">Dalia (MX Female)</option>
                    </optgroup>
                    <optgroup label="German">
                      <option value="de-DE-KatjaNeural">Katja (DE Female)</option>
                      <option value="de-DE-ConradNeural">Conrad (DE Male)</option>
                    </optgroup>
                  </Select>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <Info size={14} className="mt-0.5 text-[var(--primary)] shrink-0" />
                <p className="text-[10px] leading-relaxed text-zinc-500">
                  Powered by Microsoft Edge neural voices. Free to use with no usage limits.
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

          {activeTab === 'export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-text-main">Export and Interop</h3>
                <p className="text-sm text-text-muted mt-1">
                  Download your learning materials for review, backup, Obsidian, and LMS import.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    id: 'notes' as const,
                    title: 'Markdown Notes',
                    description: `${allNotes.length} notes as one Markdown file.`,
                    icon: FileText,
                    label: 'Export MD',
                  },
                  {
                    id: 'pdf' as const,
                    title: 'PDF Study Pack',
                    description: 'Notes, quizzes, flashcards, and glossary in a printable pack.',
                    icon: Download,
                    label: 'Export PDF',
                  },
                  {
                    id: 'obsidian' as const,
                    title: 'Obsidian Vault',
                    description: 'ZIP with Markdown folders for notes, quizzes, flashcards, and glossary.',
                    icon: Archive,
                    label: 'Export ZIP',
                  },
                  {
                    id: 'quizCsv' as const,
                    title: 'Quiz CSV',
                    description: 'Question bank CSV for spreadsheets and generic import tools.',
                    icon: FileText,
                    label: 'Export CSV',
                  },
                  {
                    id: 'qti' as const,
                    title: 'LMS QTI Package',
                    description: 'QTI 1.2 ZIP for LMS question import workflows.',
                    icon: Archive,
                    label: 'Export QTI',
                  },
                ].map(option => (
                  <div key={option.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0">
                        <option.icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-text-main">{option.title}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">{option.description}</p>
                        <button
                          type="button"
                          onClick={() => handleExport(option.id)}
                          disabled={exporting !== null}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {exporting === option.id ? 'Exporting...' : option.label}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <Info size={14} className="mt-0.5 text-[var(--primary)] shrink-0" />
                <p className="text-[10px] leading-relaxed text-zinc-500">
                  LMS packages include quiz questions that can be reloaded from submitted quiz sources. Sources without available generated questions are skipped.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-text-main">Capture & Calendar</h3>
                <p className="text-sm text-text-muted mt-1">
                  Clip web pages into your library from anywhere, and see your study schedule in your calendar app.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                  <h4 className="font-semibold text-text-main">Web Clipper bookmarklet</h4>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    Drag this button to your bookmarks bar. On any article, click it to clip the page into your library.
                  </p>
                  <a
                    href={`javascript:(function(){window.open('${window.location.origin}/summarizer?tab=web&clip='+encodeURIComponent(location.href),'_blank');})();`}
                    onClick={(e) => e.preventDefault()}
                    draggable
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white cursor-grab"
                    title="Drag me to your bookmarks bar"
                  >
                    📎 Clip to Easy Study
                  </a>
                  <p className="mt-2 text-[10px] text-zinc-400">
                    A browser-extension version lives in the repo's <code>extension/</code> folder.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                  <h4 className="font-semibold text-text-main">Calendar feed (.ics)</h4>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    Flashcards due per day, planned study blocks, and exam dates for the next two weeks — importable into Google, Apple, or Outlook calendars.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const blob = await gamificationService.downloadCalendarIcs();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'easy-study.ics';
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch { /* best-effort download */ }
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    <Download size={13} /> Download .ics
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'export' && (
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
          )}
        </div>
      </div>
    </div>
  );
};
