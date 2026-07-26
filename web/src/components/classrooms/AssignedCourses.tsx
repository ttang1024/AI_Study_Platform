import React, { useState } from 'react';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import type { ClassroomCourse } from '../../services/classroomService';
import type { Course } from '@core/types';

interface Props {
  courses: ClassroomCourse[];
  assignableCourses: Course[];
  canManage: boolean;
  onAssign: (courseId: string, dueAt?: string) => Promise<void>;
  onUnassign: (classroomCourseId: string) => Promise<void>;
}

export const AssignedCourses: React.FC<Props> = ({
  courses,
  assignableCourses,
  canManage,
  onAssign,
  onUnassign,
}) => {
  const [adding, setAdding] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!courseId) return;
    setBusy(true);
    try {
      await onAssign(courseId, dueAt || undefined);
      setAdding(false);
      setCourseId('');
      setDueAt('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {courses.length === 0 && !adding && (
        <p className="text-sm text-text-muted">
          {canManage
            ? 'No courses assigned yet. Assign one from your library so students can study it.'
            : 'Your instructor has not assigned any courses yet.'}
        </p>
      )}

      {courses.length > 0 && (
        <ul className="space-y-2">
          {courses.map((c) => (
            <li
              key={c.classroomCourseId}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface"
            >
              <BookOpen className="w-4 h-4 text-teal-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-text-main">{c.courseName}</span>
                {c.dueAt && (
                  <span className="block text-xs text-text-muted">Due {new Date(c.dueAt).toLocaleDateString()}</span>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => void onUnassign(c.classroomCourseId)}
                  className="text-text-muted hover:text-red-600 transition-colors"
                  aria-label={`Unassign ${c.courseName}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (adding ? (
          <div className="p-4 rounded-lg border border-border bg-surface space-y-3">
            <div>
              <label className="block text-sm text-text-muted mb-1">Course from your library</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
              >
                <option value="">Select…</option>
                {assignableCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {assignableCourses.length === 0 && (
                <p className="text-xs text-text-muted mt-1">
                  Every course in your library is already assigned to this classroom.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">Due date (optional)</label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-surface"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAdding(false)}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={!courseId || busy}
                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 text-sm"
              >
                {busy ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
          >
            <Plus className="w-4 h-4" /> Assign a course
          </button>
        ))}
    </div>
  );
};

export default AssignedCourses;
