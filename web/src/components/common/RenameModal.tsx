import React from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';

interface RenameModalProps {
  isOpen: boolean;
  /** Modal heading, e.g. "Edit file name". */
  title: string;
  /** Field label above the input, e.g. "File name". */
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
}

/** Single-field rename dialog, shared by every library card that can be retitled. */
export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen, title, label, value, onChange, error, isSaving = false, onClose, onSubmit,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={() => !isSaving && onClose()}
    title={title}
    className="max-w-md"
  >
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
          {label}
        </label>
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-text-main outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        />
        {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-text-main hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving && <Loader2 size={13} className="animate-spin" />}
          Save
        </button>
      </div>
    </form>
  </Modal>
);
