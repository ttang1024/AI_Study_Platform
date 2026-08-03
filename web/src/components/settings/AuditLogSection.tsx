import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { securityService, type AuditEntry } from '../../services/securityService';

/**
 * Plain-English labels for the action keys. A map rather than a formatter, because these are read
 * by someone checking whether their account was touched — "auth.2fa.recovery_used" answers that
 * question far worse than "Recovery code used" does.
 */
const ACTION_LABELS: Record<string, string> = {
  'auth.login.succeeded': 'Signed in',
  'auth.login.failed': 'Failed sign-in attempt',
  'auth.logout.all': 'Signed out other devices',
  'auth.password.changed': 'Password changed',
  'auth.password.reset': 'Password reset',
  'auth.2fa.enabled': 'Two-factor turned on',
  'auth.2fa.disabled': 'Two-factor turned off',
  'auth.2fa.failed': 'Failed two-factor code',
  'auth.2fa.recovery_used': 'Recovery code used',
  'auth.2fa.recovery_regenerated': 'New recovery codes generated',
  'auth.session.revoked': 'Device signed out',
  'account.export.requested': 'Data export requested',
  'account.export.downloaded': 'Data export downloaded',
  'account.deletion.requested': 'Account deletion requested',
  'account.deletion.cancelled': 'Account deletion cancelled',
  'apikey.created': 'API key created',
  'apikey.revoked': 'API key revoked',
  'webhook.created': 'Webhook added',
  'webhook.deleted': 'Webhook removed',
  'admin.user.viewed': 'An administrator viewed your account',
};

/** Actions worth drawing the eye to when someone is scanning for trouble. */
const ALARMING = new Set([
  'auth.login.failed',
  'auth.2fa.failed',
  'auth.2fa.disabled',
  'auth.2fa.recovery_used',
  'admin.user.viewed',
]);

export const AuditLogSection: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const { data } = await securityService.getAuditLog(nextPage, 25);
      setEntries(data.data.items);
      setHasNext(data.data.hasNextPage);
      setPage(data.data.page);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  return (
    <section className="space-y-4">
      <header>
        <h3 className="flex items-center gap-2 text-lg font-bold text-text-main">
          <History size={18} /> Security log
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          Sign-ins and changes to your account, newest first.
        </p>
      </header>

      {entries === null ? (
        <div className="flex items-center gap-2 py-4 text-text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : entries.length === 0 ? (
        <p className="py-4 text-sm text-text-muted">Nothing recorded yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)]">
            {entries.map(entry => (
              <li key={entry.auditLogEntryId} className="flex items-center justify-between gap-4 p-3">
                <div className="min-w-0">
                  <p
                    className={
                      ALARMING.has(entry.action)
                        ? 'text-sm font-medium text-amber-700'
                        : 'text-sm text-text-main'
                    }
                  >
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                    {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => load(page + 1)}
              disabled={!hasNext || loading}
              className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
            <span className="text-xs text-text-muted">Page {page}</span>
          </div>
        </>
      )}
    </section>
  );
};
