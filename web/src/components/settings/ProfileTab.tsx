import React, { useEffect, useState } from 'react';
import { User, Timer, BellRing, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { pomodoroSettings } from '../../services/pomodoroSettings';
import { pushService } from '../../services/pushService';
import { SettingsAlert } from './SettingsAlert';
import { SaveFooter } from './SaveFooter';

export const ProfileTab: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [timerEnabled, setTimerEnabled] = useState(() => pomodoroSettings.isEnabled());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Web-push reminder toggle: reflects this browser's actual subscription state.
  const [pushSupported] = useState(() => pushService.isSupported());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  useEffect(() => {
    if (pushSupported) pushService.isSubscribed().then(setPushEnabled).catch(() => { });
  }, [pushSupported]);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (pushEnabled) {
        await pushService.unsubscribe();
        setPushEnabled(false);
      } else {
        const ok = await pushService.subscribe();
        setPushEnabled(ok);
        if (!ok) {
          setPushError(
            Notification.permission === 'denied'
              ? 'Notifications are blocked for this site. Allow them in your browser settings, then try again.'
              : 'Could not enable reminders — the server has no push keys configured.',
          );
        }
      }
    } catch {
      setPushEnabled(false);
      setPushError('Could not update the reminder subscription. Please try again.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({ fullName: name.trim() });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
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
              onChange={(e) => { setName(e.target.value); setSuccess(false); }}
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

          {pushSupported && (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-[var(--primary)]/10 p-2 text-[var(--primary)]">
                  <BellRing size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-main">Review reminders</p>
                  <p className="text-xs text-text-muted">Get a browser notification when flashcards come due — once a day, at most.</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pushEnabled}
                disabled={pushBusy}
                onClick={togglePush}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:cursor-wait disabled:opacity-60',
                  pushEnabled ? 'bg-[var(--primary)]' : 'bg-zinc-300',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform',
                    pushEnabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
                  )}
                >
                  {pushBusy && <Loader2 size={12} className="animate-spin text-zinc-400" />}
                </span>
              </button>
            </div>
          )}
          {pushError && <p className="mt-2 text-xs text-red-500">{pushError}</p>}
        </div>

        {error && <SettingsAlert kind="error">{error}</SettingsAlert>}
        {success && <SettingsAlert kind="success">Profile updated successfully.</SettingsAlert>}
      </div>
      <SaveFooter saving={isSaving} onSave={handleSave} />
    </>
  );
};
