import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileArchive, Loader2, TriangleAlert } from 'lucide-react';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  securityService,
  type DataExport,
} from '../../services/securityService';
import { SettingsAlert } from './SettingsAlert';
import { formatBytes } from '@core/utils/format';

/** Exports are built by a worker, so the list has to poll while anything is in flight. */
const POLL_INTERVAL_MS = 5000;

export const DataRightsSection: React.FC = () => {
  const [exports, setExports] = useState<DataExport[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await securityService.getExports();
      setExports(data.data);
      return data.data;
    } catch {
      setExports([]);
      return [];
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Polls only while something is actually being built, and stops as soon as nothing is —
  // a permanent timer on a settings tab is a background request every few seconds forever.
  useEffect(() => {
    const pending = (exports ?? []).some(e => e.status === 'Pending' || e.status === 'Running');
    if (!pending) return;
    const timer = setInterval(() => { void load(); }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [exports, load]);

  const request = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const { data } = await securityService.requestExport();
      setNotice(data.message);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not start the export.');
    } finally {
      setBusy(false);
    }
  };

  const download = async (id: string) => {
    setError(null);
    try {
      const { data } = await securityService.getExportDownloadUrl(id);
      // The server hands back a short-lived signed URL rather than the bytes, so the browser
      // fetches straight from storage and the API never streams hundreds of megabytes.
      window.location.href = data.data;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'That download is no longer available.');
    }
  };

  const requestDeletion = async () => {
    setDeleting(true); setDeleteError(null);
    try {
      const { data } = await securityService.requestAccountDeletion(password, confirmation);
      setScheduledFor(data.data);
      setPassword(''); setConfirmation('');
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message ?? 'Could not schedule deletion.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <header>
          <h3 className="flex items-center gap-2 text-lg font-bold text-text-main">
            <FileArchive size={18} /> Download your data
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            A ZIP of everything we hold on you — library, notes, flashcards, review history, and more.
            Large libraries take a few minutes.
          </p>
        </header>

        {error && <SettingsAlert kind="error">{error}</SettingsAlert>}
        {notice && <SettingsAlert kind="success">{notice}</SettingsAlert>}

        <button
          onClick={request}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <FileArchive size={16} />}
          Request an export
        </button>

        {exports && exports.length > 0 && (
          <ul className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)]">
            {exports.map(item => (
              <li key={item.dataExportRequestId} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-main">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {item.status === 'Completed'
                      ? `Ready${item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ''}${
                          item.expiresAt
                            ? ` · expires ${new Date(item.expiresAt).toLocaleDateString()}`
                            : ''
                        }`
                      : item.status === 'Failed'
                        ? item.errorMessage ?? 'Failed'
                        : 'Preparing…'}
                  </p>
                </div>
                {item.isDownloadable ? (
                  <button
                    onClick={() => download(item.dataExportRequestId)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--bg-main)]"
                  >
                    <Download size={14} /> Download
                  </button>
                ) : (item.status === 'Pending' || item.status === 'Running') ? (
                  <Loader2 size={16} className="shrink-0 animate-spin text-text-muted" />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <header>
          <h3 className="flex items-center gap-2 text-lg font-bold text-red-600">
            <TriangleAlert size={18} /> Delete your account
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            You&apos;ll be signed out immediately. Your data is kept for 7 days in case you change your
            mind — log in during that window to cancel. After that it&apos;s gone for good.
          </p>
        </header>

        {scheduledFor ? (
          <SettingsAlert kind="success">
            Scheduled for {new Date(scheduledFor).toLocaleDateString()}. Log in before then to cancel.
          </SettingsAlert>
        ) : (
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-4">
            {deleteError && <SettingsAlert kind="error">{deleteError}</SettingsAlert>}

            <div className="space-y-2">
              <label htmlFor="delete-password" className="text-sm font-medium text-text-main">
                Your password
              </label>
              <input
                id="delete-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full max-w-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="delete-confirm" className="text-sm font-medium text-text-main">
                Type <code className="font-mono">{ACCOUNT_DELETION_CONFIRMATION}</code> to confirm
              </label>
              <input
                id="delete-confirm"
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={requestDeletion}
              disabled={
                deleting || !password || confirmation.trim() !== ACCOUNT_DELETION_CONFIRMATION
              }
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              {deleting && <Loader2 size={16} className="animate-spin" />}
              Delete my account
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
