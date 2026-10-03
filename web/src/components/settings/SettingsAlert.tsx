import React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

/** Red error / green success message box used across the settings tabs. */
export const SettingsAlert: React.FC<{ kind: 'error' | 'success'; children: React.ReactNode }> = ({ kind, children }) => (
  kind === 'error' ? (
    <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
      <ShieldAlert size={14} />
      {children}
    </div>
  ) : (
    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 border border-emerald-100">
      <CheckCircle2 size={14} />
      {children}
    </div>
  )
);
