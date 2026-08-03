import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react';
import { securityService, type TwoFactorStatus } from '../../services/securityService';
import { cn } from '../../utils/cn';
import { SettingsAlert } from './SettingsAlert';

/**
 * Enrolment is three states, not a form: off, mid-setup (secret issued, not yet proven), and on.
 * They are modelled explicitly because the middle one is the only time the secret exists on the
 * client, and leaving it on screen after confirmation would undo the point of showing it once.
 */
type Stage = 'loading' | 'off' | 'enrolling' | 'on';

const RECOVERY_WARNING_THRESHOLD = 3;

export const TwoFactorSection: React.FC = () => {
  const [stage, setStage] = useState<Stage>('loading');
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await securityService.getTwoFactorStatus();
      setStatus(data.data);
      setStage(data.data.enabled ? 'on' : 'off');
    } catch {
      setError('Could not load your two-factor status.');
      setStage('off');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const fail = (err: any, fallback: string) =>
    setError(err?.response?.data?.message ?? fallback);

  const startSetup = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const { data } = await securityService.startTwoFactorSetup();
      setSecret(data.data.secret);
      // Rendered client-side from the URI the server built. The secret never goes to a QR service —
      // that would hand a third party the one value that makes the second factor a second factor.
      setQrDataUrl(await QRCode.toDataURL(data.data.otpAuthUri, { margin: 1, width: 220 }));
      setStage('enrolling');
    } catch (err) {
      fail(err, 'Could not start setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await securityService.confirmTwoFactor(code);
      setRecoveryCodes(data.data.recoveryCodes);
      // Cleared as soon as it is proven stored: there is no reason for the secret to stay in
      // component state, or on screen, once enrolment is done.
      setSecret(''); setQrDataUrl(''); setCode('');
      await load();
    } catch (err) {
      fail(err, 'That code was not accepted.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await securityService.disableTwoFactor(password);
      setNotice(data.message);
      setPassword(''); setRecoveryCodes(null);
      await load();
    } catch (err) {
      fail(err, 'Could not turn off two-factor authentication.');
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true); setError(null);
    try {
      const { data } = await securityService.regenerateRecoveryCodes(password);
      setRecoveryCodes(data.data.recoveryCodes);
      setPassword('');
      await load();
    } catch (err) {
      fail(err, 'Could not generate new recovery codes.');
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    if (!recoveryCodes) return;
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (stage === 'loading') {
    return (
      <div className="flex items-center gap-2 py-6 text-text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-text-main">
            <ShieldCheck size={18} /> Two-factor authentication
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Ask for a code from your authenticator app as well as your password.
          </p>
        </div>
        {stage === 'on' && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            On
          </span>
        )}
      </header>

      {error && <SettingsAlert kind="error">{error}</SettingsAlert>}
      {notice && <SettingsAlert kind="success">{notice}</SettingsAlert>}

      {recoveryCodes && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900">
                Save these recovery codes now
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Each one signs you in once if you lose your authenticator. They will not be shown again.
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-amber-900 sm:grid-cols-2">
                {recoveryCodes.map(rc => <li key={rc}>{rc}</li>)}
              </ul>
              <button
                onClick={copyCodes}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'off' && (
        <button
          onClick={startSetup}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          Set up two-factor authentication
        </button>
      )}

      {stage === 'enrolling' && (
        <div className="space-y-4 rounded-xl border border-[var(--border-color)] p-4">
          <p className="text-sm text-text-muted">
            Scan this with your authenticator app, then enter the six-digit code it shows.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Two-factor setup QR code"
                className="h-[220px] w-[220px] shrink-0 rounded-lg bg-white p-2"
              />
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs font-medium text-text-muted">
                  Can&apos;t scan? Enter this key manually:
                </p>
                <code className="mt-1 block break-all rounded-lg bg-[var(--bg-main)] p-2 font-mono text-xs text-text-main">
                  {secret}
                </code>
              </div>
              <div>
                <label htmlFor="totp-code" className="text-sm font-medium text-text-main">
                  Code from your app
                </label>
                <input
                  id="totp-code"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={7}
                  className="mt-1 w-40 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-mono tracking-widest"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirm}
                  disabled={busy || code.replace(/\D/g, '').length !== 6}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  Turn it on
                </button>
                <button
                  onClick={() => { setStage('off'); setSecret(''); setQrDataUrl(''); setCode(''); }}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === 'on' && (
        <div className="space-y-4 rounded-xl border border-[var(--border-color)] p-4">
          <p
            className={cn(
              'text-sm',
              (status?.recoveryCodesRemaining ?? 0) <= RECOVERY_WARNING_THRESHOLD
                ? 'font-medium text-amber-700'
                : 'text-text-muted',
            )}
          >
            {status?.recoveryCodesRemaining ?? 0} recovery code
            {status?.recoveryCodesRemaining === 1 ? '' : 's'} left.
            {(status?.recoveryCodesRemaining ?? 0) <= RECOVERY_WARNING_THRESHOLD &&
              ' Generate a new set soon.'}
          </p>

          <div className="space-y-2">
            <label htmlFor="twofa-password" className="text-sm font-medium text-text-main">
              Confirm your password to make changes
            </label>
            <input
              id="twofa-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full max-w-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={regenerate}
                disabled={busy || !password}
                className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-text-main disabled:opacity-50"
              >
                New recovery codes
              </button>
              <button
                onClick={disable}
                disabled={busy || !password}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <ShieldOff size={16} /> Turn off
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
