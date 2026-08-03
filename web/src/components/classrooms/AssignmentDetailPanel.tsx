import React, { useState } from 'react';
import { X, Send, Save, Lock, AlertTriangle } from 'lucide-react';
import type {
  ClassroomAssignmentDetail,
  ClassroomSubmission,
} from '../../services/classroomService';

interface Props {
  detail: ClassroomAssignmentDetail;
  readOnly: boolean;
  onClose: () => void;
  onSaveSubmission: (assignmentId: string, text: string, submit: boolean) => Promise<void>;
  onGrade: (
    assignmentId: string,
    studentUserId: string,
    points: number | null,
    feedback?: string,
  ) => Promise<void>;
}

/**
 * One assignment, opened.
 *
 * Which half renders is decided by the payload, not by a role prop: the server sends `mySubmission`
 * to a student and `submissions` to staff, and never both. That keeps the privacy rule in one place
 * — if the server ever stopped withholding, the UI would not be what was holding the line.
 */
export const AssignmentDetailPanel: React.FC<Props> = ({
  detail,
  readOnly,
  onClose,
  onSaveSubmission,
  onGrade,
}) => {
  const { assignment, mySubmission, submissions } = detail;
  const isStaffView = submissions !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl my-8 rounded-xl bg-surface border border-border">
        <div className="flex items-start justify-between gap-3 p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-text-main">{assignment.title}</h2>
            <p className="text-sm text-text-muted mt-1">
              {assignment.pointsPossible} points
              {assignment.courseName && ` · ${assignment.courseName}`}
              {assignment.dueAt && ` · due ${new Date(assignment.dueAt).toLocaleString()}`}
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-main" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {assignment.instructions && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-2">
                Instructions
              </h3>
              <p className="text-sm text-text-main whitespace-pre-wrap">{assignment.instructions}</p>
            </div>
          )}

          {isStaffView ? (
            <GradingList
              submissions={submissions!}
              pointsPossible={assignment.pointsPossible}
              readOnly={readOnly}
              onGrade={(studentUserId, points, feedback) =>
                onGrade(assignment.classroomAssignmentId, studentUserId, points, feedback)
              }
            />
          ) : (
            <StudentSubmission
              submission={mySubmission}
              pointsPossible={assignment.pointsPossible}
              dueAt={assignment.dueAt}
              allowLate={assignment.allowLateSubmissions}
              readOnly={readOnly}
              onSave={(text, submit) => onSaveSubmission(assignment.classroomAssignmentId, text, submit)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Student half ────────────────────────────────────────────────────────────

const StudentSubmission: React.FC<{
  submission: ClassroomSubmission | null;
  pointsPossible: number;
  dueAt?: string;
  allowLate: boolean;
  readOnly: boolean;
  onSave: (text: string, submit: boolean) => Promise<void>;
}> = ({ submission, pointsPossible, dueAt, allowLate, readOnly, onSave }) => {
  const serverText = submission?.text ?? '';
  const [text, setText] = useState(serverText);
  const [syncedWith, setSyncedWith] = useState(serverText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A save or a grade re-fetches the assignment, and whatever the server now holds replaces what is
  // in the box. Adjusted during render rather than in an effect: React re-runs this component before
  // committing, so the box never paints one frame of stale text.
  if (serverText !== syncedWith) {
    setSyncedWith(serverText);
    setText(serverText);
  }

  const isGraded = submission?.status === 'graded';
  const pastDue = dueAt != null && new Date(dueAt) < new Date();
  const locked = readOnly || isGraded || (pastDue && !allowLate);

  const save = async (submit: boolean) => {
    setBusy(true);
    setError('');
    try {
      await onSave(text, submit);
      // Success closes the panel, so busy is left set — re-enabling the buttons during teardown
      // would offer a second click that submits the same thing twice.
    } catch {
      setError('That could not be saved.');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Your work</h3>
        {submission?.submittedAt && (
          <span className="text-xs text-text-muted">
            Handed in {new Date(submission.submittedAt).toLocaleString()}
          </span>
        )}
      </div>

      {isGraded ? (
        <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50 space-y-2">
          <p className="text-sm font-medium text-emerald-800">
            Graded: {submission!.pointsAwarded}/{pointsPossible}
          </p>
          {submission!.feedback && (
            <p className="text-sm text-emerald-900 whitespace-pre-wrap">{submission!.feedback}</p>
          )}
        </div>
      ) : (
        pastDue &&
        !allowLate && (
          <p className="flex items-center gap-2 text-sm text-orange-700">
            <AlertTriangle className="w-4 h-4" /> The deadline has passed and this assignment does not
            accept late work.
          </p>
        )
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        disabled={locked}
        placeholder="Write your answer here. Save a draft as often as you like — only you can see it until you hand in."
        className="w-full px-3 py-2 rounded-lg border border-border bg-surface disabled:opacity-60 font-mono text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {locked ? (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Lock className="w-3.5 h-3.5" />
          {isGraded
            ? 'Graded work is locked. Ask your instructor to clear the grade if you need to revise.'
            : 'This assignment is closed.'}
        </p>
      ) : (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => void save(false)}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" /> Save draft
          </button>
          <button
            onClick={() => void save(true)}
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 text-sm"
          >
            <Send className="w-4 h-4" />
            {submission?.submittedAt ? 'Hand in again' : 'Hand in'}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Staff half ──────────────────────────────────────────────────────────────

const GradingList: React.FC<{
  submissions: ClassroomSubmission[];
  pointsPossible: number;
  readOnly: boolean;
  onGrade: (studentUserId: string, points: number | null, feedback?: string) => Promise<void>;
}> = ({ submissions, pointsPossible, readOnly, onGrade }) => {
  const [openStudent, setOpenStudent] = useState<string | null>(null);

  if (submissions.length === 0)
    return <p className="text-sm text-text-muted">No students are enrolled yet.</p>;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Submissions</h3>
      <ul className="space-y-2">
        {submissions.map((s) => {
          const handedIn = s.status !== 'not_started' && s.status !== 'draft';
          const isOpen = openStudent === s.studentUserId;
          return (
            <li key={s.studentUserId} className="rounded-lg border border-border bg-surface">
              <button
                onClick={() => setOpenStudent(isOpen ? null : s.studentUserId)}
                disabled={!handedIn}
                className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
              >
                <span className="flex-1 min-w-0 font-medium text-text-main truncate">{s.studentName}</span>
                <span className="text-xs text-text-muted whitespace-nowrap">
                  {s.status === 'not_started'
                    ? 'Not started'
                    : s.status === 'draft'
                      ? 'Draft — not handed in'
                      : s.status === 'late'
                        ? 'Late'
                        : s.status === 'graded'
                          ? `${s.pointsAwarded}/${pointsPossible}`
                          : 'Handed in'}
                </span>
              </button>

              {isOpen && handedIn && (
                <GradeForm
                  submission={s}
                  pointsPossible={pointsPossible}
                  readOnly={readOnly}
                  onGrade={(points, feedback) => onGrade(s.studentUserId, points, feedback)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const GradeForm: React.FC<{
  submission: ClassroomSubmission;
  pointsPossible: number;
  readOnly: boolean;
  onGrade: (points: number | null, feedback?: string) => Promise<void>;
}> = ({ submission, pointsPossible, readOnly, onGrade }) => {
  const [points, setPoints] = useState(
    submission.pointsAwarded != null ? String(submission.pointsAwarded) : '',
  );
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submitGrade = async (clear: boolean) => {
    setBusy(true);
    setError('');
    try {
      await onGrade(clear ? null : Number(points), feedback.trim() || undefined);
      // Releasing a grade closes the panel; clearing keeps it open, so hand the buttons back.
      if (clear) setBusy(false);
    } catch {
      setError(`Could not save that grade. Scores must be between 0 and ${pointsPossible}.`);
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
      <p className="text-sm text-text-main whitespace-pre-wrap max-h-80 overflow-y-auto">
        {submission.text}
      </p>

      {!readOnly && (
        <>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-text-muted mb-1">Score</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={pointsPossible}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="w-24 px-3 py-2 rounded-lg border border-border bg-surface"
                />
                <span className="text-sm text-text-muted">/ {pointsPossible}</span>
              </div>
            </div>
            <div className="flex-1 min-w-[16rem]">
              <label className="block text-xs text-text-muted mb-1">Feedback</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            {submission.status === 'graded' && (
              <button
                onClick={() => void submitGrade(true)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover disabled:opacity-50 text-sm"
                title="Returns the work to the student so they can revise it"
              >
                Clear grade
              </button>
            )}
            <button
              onClick={() => void submitGrade(false)}
              disabled={busy || points === ''}
              className="px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 text-sm"
            >
              {busy ? 'Saving…' : 'Release grade'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AssignmentDetailPanel;
