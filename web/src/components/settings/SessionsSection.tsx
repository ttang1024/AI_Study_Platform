import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, MonitorSmartphone } from 'lucide-react';
import { securityService, type ActiveSession } from '../../services/securityService';
import { SettingsAlert } from './SettingsAlert';

const formatWhen = (iso: string | null) => {
  if (!iso) return 'unknown';
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
};

export const SessionsSection: React.FC = () => {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await securityService.getSessions();
      setSessions(data.data);
    } catch {
      setError('Could not load your sessions.');
      setSessions([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const revoke = async (sessionId: string) => {
    setBusyId(sessionId); setError(null); setNotice(null);
    try {
      const { data } = await securityService.revokeSession(sessionId);
      setNotice(data.message);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not sign that device out.');
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setBusyId('others'); setError(null); setNotice(null);
    try {
      const { data } = await securityService.revokeOtherSessions();
      setNotice(data.message);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not sign the other devices out.');
    } finally {
      setBusyId(null);
    }
  };

  const otherCount = (sessions ?? []).filter(s => !s.isCurrent).length;

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-text-main">
            <MonitorSmartphone size={18} /> Active sessions
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Everywhere you&apos;re signed in. Sign out anything you don&apos;t recognise.
          </p>
        </div>
        {otherCount > 0 && (
          <button
            onClick={revokeOthers}
            disabled={busyId !== null}
            className="shrink-0 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-text-main disabled:opacity-50"
          >
            {busyId === 'others' ? 'Signing out…' : 'Sign out others'}
          </button>
        )}
      </header>

      {error && <SettingsAlert kind="error">{error}</SettingsAlert>}
      {notice && <SettingsAlert kind="success">{notice}</SettingsAlert>}

      {sessions === null ? (
        <div className="flex items-center gap-2 py-4 text-text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : sessions.length === 0 ? (
        <p className="py-4 text-sm text-text-muted">No active sessions found.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)]">
          {sessions.map(session => (
            <li key={session.sessionId} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-text-main">
                  {session.deviceName ?? 'Unknown device'}
                  {session.isCurrent && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      This device
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {session.ipAddress ?? 'unknown IP'} · signed in{' '}
                  {new Date(session.startedAt).toLocaleDateString()} · last active{' '}
                  {formatWhen(session.lastUsedAt)}
                </p>
              </div>
              {/* The current session is revoked by signing out, not from this list — a button here
                  that logs you out mid-audit reads as a bug rather than an action. */}
              {!session.isCurrent && (
                <button
                  onClick={() => revoke(session.sessionId)}
                  disabled={busyId !== null}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {busyId === session.sessionId
                    ? <Loader2 size={14} className="animate-spin" />
                    : <LogOut size={14} />}
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
