import React, { useState } from 'react';
import { Eye, EyeOff, Info, Wifi } from 'lucide-react';
import { cn } from '../../utils/cn';
import { aiSettingsService, DEFAULT_MODELS, type AIProvider, type AISettings } from '../../services/aiSettingsService';
import { AI_PROVIDERS } from '@core/ai';
import { apiClient } from '../../services/apiClient';
import { ProviderIcon } from './ProviderIcon';
import { SettingsAlert } from './SettingsAlert';
import { SaveFooter } from './SaveFooter';

export const AiServicesTab: React.FC = () => {
  const [aiSettings, setAISettings] = useState<AISettings>(() => aiSettingsService.load());
  const [viewedProvider, setViewedProvider] = useState<AIProvider>(() => aiSettingsService.load().provider);
  const [showAIKey, setShowAIKey] = useState(false);
  const [success, setSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSave = () => {
    aiSettingsService.save(aiSettings);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
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

  const viewed = AI_PROVIDERS.find(p => p.id === viewedProvider)!;

  return (
    <>
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
                onClick={() => { setAISettings(s => ({ ...s, provider: viewedProvider })); setSuccess(false); }}
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
                  setSuccess(false);
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
                setSuccess(false);
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

        {success && <SettingsAlert kind="success">AI settings saved successfully.</SettingsAlert>}
      </div>
      <SaveFooter onSave={handleSave} />
    </>
  );
};
