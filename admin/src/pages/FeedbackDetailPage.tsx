import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Star, Trash2, Save, User, Calendar } from 'lucide-react';
import { adminApi } from '../services/api';
import type { FeedbackItem, FeedbackStatus } from '../types';
import { TypeBadge, StatusBadge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/format';
import { cn } from '../utils/cn';

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
];

export const FeedbackDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<FeedbackItem | null>(null);
  const [error, setError] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminApi.getFeedback(id)
      .then((data) => {
        setItem(data);
        setAdminNote(data.adminNote ?? '');
        // Auto-mark as read if new
        if (data.status === 'new') {
          adminApi.updateStatus(id, 'read').then(setItem).catch(() => {});
        }
      })
      .catch(() => setError('Feedback not found.'));
  }, [id]);

  const handleStatusChange = async (status: FeedbackStatus) => {
    if (!item) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await adminApi.updateStatus(item.id, status);
      setItem(updated);
    } catch {
      setError('Failed to update status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveNote = async () => {
    if (!item) return;
    setIsSavingNote(true);
    try {
      const updated = await adminApi.saveAdminNote(item.id, adminNote);
      setItem(updated);
    } catch {
      setError('Failed to save note.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setIsDeleting(true);
    try {
      await adminApi.deleteFeedback(item.id);
      navigate('/feedback');
    } catch {
      setError('Failed to delete feedback.');
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (error && !item) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        <Link to="/feedback" className="mt-4 text-sm text-emerald-700 hover:underline">Back to feedback</Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-xl bg-black/5 animate-pulse" />
        <div className="h-48 rounded-2xl bg-black/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Back + title */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          to="/feedback"
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={15} />
          Feedback
        </Link>
        <span className="text-[var(--border-color)]">/</span>
        <span className="text-sm text-[var(--text-secondary)] truncate max-w-[200px]">{item.subject}</span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-5">
        {/* Main card */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-7">
          {/* Header */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <TypeBadge type={item.type} />
              <StatusBadge status={item.status} />
              {item.rating != null && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <Star size={10} className="fill-amber-500 text-amber-500" />
                  {item.rating}/5
                </span>
              )}
            </div>
          </div>

          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">{item.subject}</h2>

          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{item.message}</p>

          {/* Meta */}
          <div className="mt-6 flex flex-wrap gap-4 border-t border-[var(--border-color)] pt-4 text-xs text-[var(--text-secondary)]">
            {item.userEmail && (
              <span className="flex items-center gap-1.5">
                <User size={12} />
                {item.userEmail}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar size={12} />
              {formatDate(item.submittedAt)}
            </span>
            {item.resolvedAt && (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Calendar size={12} />
                Resolved {formatDate(item.resolvedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Actions card */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-7">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Update Status</h3>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                disabled={isUpdatingStatus}
                onClick={() => handleStatusChange(value)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50',
                  item.status === value
                    ? 'border-emerald-500 bg-emerald-600/10 text-emerald-700'
                    : 'border-[var(--border-color)] bg-transparent text-[var(--text-secondary)] hover:border-emerald-500/40 hover:text-[var(--text-primary)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Admin note */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-7">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Internal Note</h3>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={4}
            placeholder="Add a private note visible only to admins…"
            className="w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              isLoading={isSavingNote}
              onClick={handleSaveNote}
              disabled={adminNote === (item.adminNote ?? '')}
            >
              <Save size={13} />
              Save Note
            </Button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-7">
          <h3 className="mb-3 text-sm font-semibold text-red-600">Danger Zone</h3>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-secondary)]">
              {deleteConfirm ? 'This action cannot be undone. Click again to confirm.' : 'Permanently delete this feedback entry.'}
            </p>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDelete}
              onBlur={() => setDeleteConfirm(false)}
            >
              <Trash2 size={13} />
              {deleteConfirm ? 'Confirm Delete' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
