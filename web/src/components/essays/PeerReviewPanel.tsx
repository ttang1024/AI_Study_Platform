import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, Loader2, MessageSquare, Send, Users } from 'lucide-react';
import {
  peerReviewService,
  type PeerReviewAssignment,
  type PeerReviewScore,
  type PeerReviewWorkspace,
} from '../../services/peerReviewService';
import { cn } from '../../utils/cn';

/**
 * The reviewer's side of peer review: a queue of drafts, and the workspace for one of them.
 *
 * The author's side lives with their essay, not here — the two roles never share a screen, and
 * combining them would put "your feedback" and "feedback you owe" in the same list.
 */
export const PeerReviewPanel: React.FC = () => {
  const [queue, setQueue] = useState<PeerReviewAssignment[] | null>(null);
  const [open, setOpen] = useState<PeerReviewWorkspace | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await peerReviewService.getMyQueue(true);
      setQueue(data.data);
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openReview = async (id: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const { data } = await peerReviewService.open(id);
      setOpen(data.data);
      setScores(Object.fromEntries(
        data.data.existingScores.map(s => [s.criterionName, s.points]),
      ));
      setComment(data.data.existingComment ?? '');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not open that draft.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!open) return;
    setBusy(true); setError(null);
    try {
      const payload: PeerReviewScore[] = open.criteria.map(c => ({
        criterionName: c.name,
        points: scores[c.name] ?? 0,
        comment: null,
      }));
      const { data } = await peerReviewService.submit(open.essayPeerReviewId, payload, comment || null);
      setNotice(data.message);
      setOpen(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not send your review.');
    } finally {
      setBusy(false);
    }
  };

  if (queue === null) {
    return (
      <div className="flex items-center gap-2 py-10 text-text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (open) {
    const readOnly = open.status === 'submitted';
    return (
      <div className="space-y-5">
        <button
          onClick={() => setOpen(null)}
          className="text-sm font-medium text-text-muted hover:text-text-main"
        >
          ← Back to queue
        </button>

        {error && (
          <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</p>
        )}

        <div>
          <h3 className="text-xl font-bold text-text-main">{open.essayTitle}</h3>
          {open.promptText && (
            <p className="mt-1 text-sm text-text-muted">Prompt: {open.promptText}</p>
          )}
          <p className="mt-1 text-xs text-text-muted">{open.wordCount} words</p>
        </div>

        <article className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[var(--border-color)] bg-[var(--bg-main)] p-5 text-sm leading-relaxed text-text-main">
          {open.essayText}
        </article>

        {open.criteria.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-text-main">Score against the rubric</h4>
            {open.criteria.map(criterion => (
              <div key={criterion.name} className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-main">{criterion.name}</p>
                  {criterion.description && (
                    <p className="text-xs text-text-muted">{criterion.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={criterion.maxPoints}
                    disabled={readOnly}
                    value={scores[criterion.name] ?? ''}
                    onChange={e =>
                      setScores(prev => ({ ...prev, [criterion.name]: Number(e.target.value) }))
                    }
                    className="w-20 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-sm disabled:opacity-60"
                  />
                  <span className="text-xs text-text-muted">/ {criterion.maxPoints}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="peer-comment" className="text-sm font-bold text-text-main">
            Your feedback
          </label>
          <textarea
            id="peer-comment"
            rows={5}
            disabled={readOnly}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="What worked, and what would you change?"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] p-3 text-sm disabled:opacity-60"
          />
        </div>

        {!readOnly && (
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send review
          </button>
        )}
        {readOnly && (
          <p className="text-sm text-text-muted">You&apos;ve already sent this review.</p>
        )}
      </div>
    );
  }

  const pending = queue.filter(q => q.status === 'assigned');
  const done = queue.filter(q => q.status === 'submitted');

  return (
    <div className="space-y-6">
      {notice && (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <header>
        <h3 className="flex items-center gap-2 text-lg font-bold text-text-main">
          <Users size={18} /> Drafts to review
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          Classmates have asked for your feedback. Your name isn&apos;t shown to them.
        </p>
      </header>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border-color)] py-16 text-center">
          <Inbox size={32} className="text-text-muted" />
          <p className="text-sm text-text-muted">Nothing to review right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {[...pending, ...done].map(item => (
            <li
              key={item.essayPeerReviewId}
              className={cn(
                'flex items-center justify-between gap-4 rounded-xl border p-4',
                item.status === 'submitted'
                  ? 'border-[var(--border-color)] opacity-60'
                  : 'border-[var(--border-color)]',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-main">{item.essayTitle}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {item.wordCount} words · asked{' '}
                  {new Date(item.assignedAt).toLocaleDateString()}
                  {item.status === 'submitted' && ' · reviewed'}
                </p>
              </div>
              <button
                onClick={() => openReview(item.essayPeerReviewId)}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm font-medium text-text-main disabled:opacity-50"
              >
                <MessageSquare size={14} />
                {item.status === 'submitted' ? 'View' : 'Review'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
