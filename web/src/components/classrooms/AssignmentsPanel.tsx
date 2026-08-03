import React, { useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, Clock, CheckCircle2, FileText } from 'lucide-react';
import type {
  ClassroomAssignment,
  ClassroomCourse,
  SaveAssignmentInput,
  SubmissionStatus,
} from '../../services/classroomService';

interface Props {
  assignments: ClassroomAssignment[];
  courses: ClassroomCourse[];
  isGrader: boolean;
  canManage: boolean;
  loading: boolean;
  onOpen: (assignmentId: string) => void;
  onCreate: (data: SaveAssignmentInput) => Promise<void>;
  onUpdate: (assignmentId: string, data: SaveAssignmentInput) => Promise<void>;
  onDelete: (assignmentId: string) => Promise<void>;
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft saved',
  submitted: 'Handed in',
  late: 'Handed in late',
  graded: 'Graded',
};

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  not_started: 'bg-surface-hover text-text-muted',
  draft: 'bg-amber-50 text-amber-700',
  submitted: 'bg-teal-50 text-teal-700',
  late: 'bg-orange-50 text-orange-700',
  graded: 'bg-emerald-50 text-emerald-700',
};

const StatusPill: React.FC<{ status: SubmissionStatus }> = ({ status }) => (
  <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASS[status]}`}>
    {STATUS_LABEL[status]}
  </span>
);

/** ISO instant → the `datetime-local` shape, in the viewer's own timezone. */
const toLocalInput = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

export const AssignmentsPanel: React.FC<Props> = ({
  assignments,
  courses,
  isGrader,
  canManage,
  loading,
  onOpen,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [editing, setEditing] = useState<ClassroomAssignment | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-text-muted">Loading assignments…</p>;

  return (
    <div className="space-y-4">
      {assignments.length === 0 && !editing && (
        <div className="text-center py-12 rounded-xl border border-dashed border-border">
          <ClipboardList className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-sm text-text-muted mt-3">
            {canManage
              ? 'No assignments yet. Set work here and collect it back from your students.'
              : 'Your instructor has not set any work yet.'}
          </p>
        </div>
      )}

      {assignments.length > 0 && (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li key={a.classroomAssignmentId}>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface">
                <button
                  onClick={() => onOpen(a.classroomAssignmentId)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-text-main">{a.title}</span>
                      {!a.isPublished && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-hover text-text-muted">
                          Draft
                        </span>
                      )}
                      {a.myStatus && <StatusPill status={a.myStatus} />}
                    </div>
                    <span className="block text-xs text-text-muted mt-0.5">
                      {a.pointsPossible} points
                      {a.courseName && ` · ${a.courseName}`}
                      {a.dueAt && ` · due ${new Date(a.dueAt).toLocaleString()}`}
                    </span>
                  </div>
                </button>

                {/* Staff see progress at a glance; students see their own score once released. */}
                {isGrader ? (
                  <span className="text-xs text-text-muted whitespace-nowrap flex items-center gap-3">
                    <span className="flex items-center gap-1" title="Handed in">
                      <Clock className="w-3.5 h-3.5" />
                      {a.submittedCount ?? 0}/{a.studentCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1" title="Graded">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {a.gradedCount ?? 0}
                    </span>
                  </span>
                ) : (
                  a.myPointsAwarded != null && (
                    <span className="text-sm font-medium text-emerald-600 whitespace-nowrap">
                      {a.myPointsAwarded}/{a.pointsPossible}
                    </span>
                  )
                )}

                {canManage && (
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(a)}
                      className="text-text-muted hover:text-text-main transition-colors p-1"
                      aria-label={`Edit ${a.title}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(a.classroomAssignmentId)}
                      className="text-text-muted hover:text-red-600 transition-colors p-1"
                      aria-label={`Delete ${a.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </span>
                )}
              </div>

              {confirmDelete === a.classroomAssignmentId && (
                <div className="mt-2 px-4 py-3 rounded-lg border border-red-200 bg-red-50 flex items-center gap-3 flex-wrap">
                  <p className="text-sm text-red-700 flex-1">
                    Delete “{a.title}”? This cannot be undone.
                  </p>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-surface text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await onDelete(a.classroomAssignmentId);
                      setConfirmDelete(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (editing ? (
          <AssignmentForm
            assignment={editing === 'new' ? null : editing}
            courses={courses}
            onCancel={() => setEditing(null)}
            onSave={async (data) => {
              if (editing === 'new') await onCreate(data);
              else await onUpdate(editing.classroomAssignmentId, data);
              setEditing(null);
            }}
          />
        ) : (
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
          >
            <Plus className="w-4 h-4" /> New assignment
          </button>
        ))}
    </div>
  );
};

const AssignmentForm: React.FC<{
  assignment: ClassroomAssignment | null;
  courses: ClassroomCourse[];
  onCancel: () => void;
  onSave: (data: SaveAssignmentInput) => Promise<void>;
}> = ({ assignment, courses, onCancel, onSave }) => {
  const [title, setTitle] = useState(assignment?.title ?? '');
  const [instructions, setInstructions] = useState(assignment?.instructions ?? '');
  const [courseId, setCourseId] = useState(assignment?.courseId ?? '');
  const [points, setPoints] = useState(String(assignment?.pointsPossible ?? 100));
  const [dueAt, setDueAt] = useState(toLocalInput(assignment?.dueAt));
  const [allowLate, setAllowLate] = useState(assignment?.allowLateSubmissions ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const alreadyPublished = assignment?.isPublished ?? false;

  const save = async (publish: boolean) => {
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onSave({
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        courseId: courseId || undefined,
        pointsPossible: Number(points) || 100,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        allowLateSubmissions: allowLate,
        publish,
      });
    } catch {
      setError('That could not be saved.');
      setBusy(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-border bg-surface space-y-3">
      <div>
        <label className="block text-sm text-text-muted mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Essay 1 — the causes of the war"
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm text-text-muted mb-1">Instructions</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
          placeholder="What should students do, and what does a good answer look like?"
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-sm text-text-muted mb-1">Points</label>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
          />
        </div>
        <div>
          <label className="block text-sm text-text-muted mb-1">Due (optional)</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
          />
        </div>
        <div>
          <label className="block text-sm text-text-muted mb-1">Course (optional)</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
          >
            <option value="">None</option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.courseName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-main">
        <input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
        Accept submissions after the due date, flagged late
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 flex-wrap">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover text-sm"
        >
          Cancel
        </button>
        {/* Publishing is one-way, so an already-published assignment offers only "Save". */}
        {!alreadyPublished && (
          <button
            onClick={() => void save(false)}
            disabled={!title.trim() || busy}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover disabled:opacity-50 text-sm"
          >
            Save as draft
          </button>
        )}
        <button
          onClick={() => void save(true)}
          disabled={!title.trim() || busy}
          className="px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 text-sm"
        >
          {busy ? 'Saving…' : alreadyPublished ? 'Save' : 'Publish to class'}
        </button>
      </div>
    </div>
  );
};

export default AssignmentsPanel;
