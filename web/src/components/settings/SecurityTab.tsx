import React, { useState } from 'react';
import { Eye, EyeOff, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { SettingsAlert } from './SettingsAlert';
import { SaveFooter } from './SaveFooter';
import { validatePassword } from '@core/utils/validatePassword';

export const SecurityTab: React.FC = () => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const newPasswordValid = validatePassword(newPassword);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (!validatePassword(newPassword)) {
      setError('New password must be 8-20 characters long and include at least 3 types: uppercase, lowercase, numbers, or symbols.');
      return;
    }
    setIsSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
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

          {error && <SettingsAlert kind="error">{error}</SettingsAlert>}
          {success && <SettingsAlert kind="success">Password changed successfully.</SettingsAlert>}
        </div>
      </div>
      <SaveFooter saving={isSaving} onSave={handleSave} />
    </>
  );
};
