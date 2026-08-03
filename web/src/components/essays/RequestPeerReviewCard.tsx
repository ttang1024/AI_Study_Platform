import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { peerReviewService, type PeerReview } from '../../services/peerReviewService';
import classroomService, { type Classroom } from '../../services/classroomService';

interface Props {
  essaySubmissionId: string;
}

/**
 * The author's side: ask classmates to review this draft, and read what comes back.
 *
 * Reviews arrive without a name attached, so this renders them as "Review 1", "Review 2" — the
 * ordering is presentational, and nothing here can identify who wrote which.
 */
export const RequestPeerReviewCard: React.FC<Props> = ({ essaySubmissionId }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classroomId, setClassroomId] = useState('');
  const [reviewerCount, setReviewerCount] = useState(2);
  const [reviews, setReviews] = useState<PeerReview[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      const { data } = await peerReviewService.getForEssay(essaySubmissionId);
      setReviews(data.data);
    } catch {
      setReviews([]);
    }
  }, [essaySubmissionId]);

  useEffect(() => {
    void loadReviews();

    // Peer review only makes sense inside a classroom, so the picker is populated from the ones the
    // user is actually in. No classrooms means the whole card stays hidden rather than offering an
    // action that cannot succeed. Archived ones are dropped — nobody is left to review in them.
    classroomService
      .getMyClassrooms()
      .then(res => setClassrooms(res.data.data.filter(c => !c.isArchived)))
      .catch(() => setClassrooms([]));
  }, [loadReviews]);

  const request = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const { data } = await peerReviewService.request(essaySubmissionId, classroomId, reviewerCount);
      setNotice(data.message);
      await loadReviews();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not request peer review.');
    } finally {
      setBusy(false);
    }
  };

  const submitted = reviews.filter(r => r.status === 'submitted');
  const waiting = reviews.filter(r => r.status === 'assigned');

  if (classrooms.length === 0 && reviews.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-color)] p-4">
      <h4 className="flex items-center gap-2 text-sm font-bold text-text-main">
        <Users size={16} /> Peer review
      </h4>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && <p className="text-xs text-emerald-600">{notice}</p>}

      {classrooms.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={classroomId}
            onChange={e => setClassroomId(e.target.value)}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs"
          >
            <option value="">Pick a classroom…</option>
            {classrooms.map(c => (
              <option key={c.classroomId} value={c.classroomId}>{c.name}</option>
            ))}
          </select>
          <select
            value={reviewerCount}
            onChange={e => setReviewerCount(Number(e.target.value))}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs"
          >
            {[1, 2, 3].map(n => (
              <option key={n} value={n}>{n} reviewer{n > 1 ? 's' : ''}</option>
            ))}
          </select>
          <button
            onClick={request}
            disabled={busy || !classroomId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {busy && <Loader2 size={12} className="animate-spin" />} Ask for review
          </button>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            {submitted.length} of {reviews.length} back
            {waiting.length > 0 && ` · ${waiting.length} still writing`}
          </p>

          {submitted.map((review, index) => (
            <div key={review.essayPeerReviewId} className="rounded-lg bg-[var(--bg-main)] p-3">
              <p className="text-xs font-bold text-text-main">
                Review {index + 1}
                {review.scorePercent !== null && ` · ${review.scorePercent}%`}
              </p>
              {review.scores.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {review.scores.map(score => (
                    <li key={score.criterionName} className="text-xs text-text-muted">
                      {score.criterionName}: {score.points}
                    </li>
                  ))}
                </ul>
              )}
              {review.overallComment && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-text-main">
                  {review.overallComment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
