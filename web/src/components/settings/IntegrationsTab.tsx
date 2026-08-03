import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, Plug, Terminal, Trash2, TriangleAlert } from 'lucide-react';
import {
  API_SCOPE_LABELS,
  WEBHOOK_EVENT_LABELS,
  integrationsService,
  type ApiKey,
  type Webhook,
} from '../../services/integrationsService';
import { SettingsAlert } from './SettingsAlert';

/** Shown once, in place, right after creation — the only moment the value exists on the client. */
const SecretReveal: React.FC<{ label: string; value: string; onDismiss: () => void }> = ({
  label, value, onDismiss,
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">{label}</p>
          <p className="mt-1 text-sm text-amber-800">
            Copy it now — it can&apos;t be shown again.
          </p>
          <code className="mt-2 block break-all rounded-lg bg-white/70 p-2 font-mono text-xs text-amber-900">
            {value}
          </code>
          <div className="mt-3 flex gap-2">
            <button
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={onDismiss}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              I&apos;ve saved it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const IntegrationsTab: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<string[]>(['library:read']);
  const [newKey, setNewKey] = useState<string | null>(null);

  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [k, w] = await Promise.all([
        integrationsService.getApiKeys(),
        integrationsService.getWebhooks(),
      ]);
      setKeys(k.data.data);
      setWebhooks(w.data.data);
    } catch {
      setError('Could not load your integrations.');
      setKeys([]); setWebhooks([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  const createKey = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await integrationsService.createApiKey({ name: keyName, scopes: keyScopes });
      setNewKey(data.data.plaintextKey);
      setKeyName('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not create the key.');
    } finally {
      setBusy(false);
    }
  };

  const revokeKey = async (id: string) => {
    setBusy(true); setError(null);
    try {
      await integrationsService.revokeApiKey(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not revoke the key.');
    } finally {
      setBusy(false);
    }
  };

  const createWebhook = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await integrationsService.createWebhook({ url: hookUrl, events: hookEvents });
      setNewSecret(data.data.secret);
      setHookUrl(''); setHookEvents([]);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not add the webhook.');
    } finally {
      setBusy(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    setBusy(true); setError(null);
    try {
      await integrationsService.deleteWebhook(id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not remove the webhook.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      {error && <SettingsAlert kind="error">{error}</SettingsAlert>}

      {/* ── API keys ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <header>
          <h3 className="flex items-center gap-2 text-lg font-bold text-text-main">
            <Terminal size={18} /> API keys
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            For scripts and integrations. Send as <code className="font-mono">X-Api-Key</code> or a
            bearer token.
          </p>
        </header>

        {newKey && (
          <SecretReveal label="Your new API key" value={newKey} onDismiss={() => setNewKey(null)} />
        )}

        <div className="space-y-3 rounded-xl border border-[var(--border-color)] p-4">
          <div className="space-y-2">
            <label htmlFor="key-name" className="text-sm font-medium text-text-main">Name</label>
            <input
              id="key-name"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              placeholder="My sync script"
              className="w-full max-w-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-sm"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-text-main">What it may do</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {Object.entries(API_SCOPE_LABELS).map(([scope, label]) => (
                <label key={scope} className="flex items-center gap-2 text-sm text-text-muted">
                  <input
                    type="checkbox"
                    checked={keyScopes.includes(scope)}
                    onChange={() => toggle(keyScopes, scope, setKeyScopes)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            onClick={createKey}
            disabled={busy || !keyName.trim() || keyScopes.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Create key
          </button>
        </div>

        {keys && keys.length > 0 && (
          <ul className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)]">
            {keys.map(key => (
              <li key={key.apiKeyId} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-main">
                    {key.name}
                    {key.revokedAt && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-500">
                        Revoked
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    <code className="font-mono">{key.prefix}…</code> · {key.scopes.join(', ')} ·{' '}
                    {key.lastUsedAt
                      ? `last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : 'never used'}
                  </p>
                </div>
                {!key.revokedAt && (
                  <button
                    onClick={() => revokeKey(key.apiKeyId)}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Webhooks ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <header>
          <h3 className="flex items-center gap-2 text-lg font-bold text-text-main">
            <Plug size={18} /> Webhooks
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            We POST to your HTTPS endpoint when things happen. Each delivery is signed so you can
            verify it came from us.
          </p>
        </header>

        {newSecret && (
          <SecretReveal
            label="Your webhook signing secret"
            value={newSecret}
            onDismiss={() => setNewSecret(null)}
          />
        )}

        <div className="space-y-3 rounded-xl border border-[var(--border-color)] p-4">
          <div className="space-y-2">
            <label htmlFor="hook-url" className="text-sm font-medium text-text-main">Endpoint URL</label>
            <input
              id="hook-url"
              value={hookUrl}
              onChange={e => setHookUrl(e.target.value)}
              placeholder="https://example.com/hooks/study"
              className="w-full max-w-lg rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-sm"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-text-main">Send me an event when…</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {Object.entries(WEBHOOK_EVENT_LABELS).map(([event, label]) => (
                <label key={event} className="flex items-center gap-2 text-sm text-text-muted">
                  <input
                    type="checkbox"
                    checked={hookEvents.includes(event)}
                    onChange={() => toggle(hookEvents, event, setHookEvents)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            onClick={createWebhook}
            disabled={busy || !hookUrl.trim() || hookEvents.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy && <Loader2 size={16} className="animate-spin" />} Add webhook
          </button>
        </div>

        {webhooks && webhooks.length > 0 && (
          <ul className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)]">
            {webhooks.map(hook => (
              <li key={hook.webhookId} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-main">
                    {hook.url}
                    {!hook.isActive && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                        Disabled after repeated failures
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {hook.events.join(', ')}
                    {hook.lastDeliveryAt &&
                      ` · last delivery ${new Date(hook.lastDeliveryAt).toLocaleString()} (${
                        hook.lastStatusCode ?? 'no response'
                      })`}
                  </p>
                </div>
                <button
                  onClick={() => deleteWebhook(hook.webhookId)}
                  disabled={busy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={14} /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
