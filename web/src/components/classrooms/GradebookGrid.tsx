import React from 'react';
import { Download } from 'lucide-react';
import type {
  Gradebook,
  GradebookCell,
  GradebookSubmissionCell,
} from '../../services/classroomService';

interface Props {
  gradebook: Gradebook;
  onOpenStudent: (userId: string) => void;
  onExportCsv?: () => void;
  exporting?: boolean;
}

/**
 * Roster × course grid, with a column per published assignment. Score cells are colour-banded so an
 * instructor can find the students who need help by scanning rather than reading every number.
 *
 * Course columns and assignment columns are kept visually distinct and never averaged together: a
 * course cell is inferred from what the student happened to do, an assignment cell is a mark someone
 * gave them, and blending the two would let activity pass for attainment.
 */
export const GradebookGrid: React.FC<Props> = ({ gradebook, onOpenStudent, onExportCsv, exporting }) => {
  const hasColumns = gradebook.courses.length > 0 || gradebook.assignments.length > 0;

  if (!hasColumns) {
    return (
      <p className="text-sm text-text-muted">
        Assign a course or publish an assignment to start collecting grades.
      </p>
    );
  }
  if (gradebook.rows.length === 0) {
    return <p className="text-sm text-text-muted">No students have enrolled yet.</p>;
  }

  return (
    <div className="space-y-3">
      {onExportCsv && (
        <div className="flex justify-end">
          <button
            onClick={onExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-surface-hover text-sm disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>
      )}

      {/* Wide tables must scroll inside their own container, never the page body. */}
      <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-surface-hover">
            <th className="text-left font-medium text-text-muted px-4 py-3 sticky left-0 bg-surface-hover z-10">
              Student
            </th>
            {gradebook.courses.map((c) => (
              <th key={c.courseId} className="text-left font-medium text-text-muted px-4 py-3 whitespace-nowrap">
                {c.courseName}
                {c.dueAt && (
                  <span className="block text-[11px] font-normal">
                    due {new Date(c.dueAt).toLocaleDateString()}
                  </span>
                )}
              </th>
            ))}
            {gradebook.assignments.map((a) => (
              <th
                key={a.classroomAssignmentId}
                className="text-left font-medium text-text-muted px-4 py-3 whitespace-nowrap border-l border-border"
              >
                {a.title}
                <span className="block text-[11px] font-normal">
                  out of {a.pointsPossible}
                  {a.dueAt && ` · due ${new Date(a.dueAt).toLocaleDateString()}`}
                </span>
              </th>
            ))}
            {gradebook.assignments.length > 0 && (
              <th className="text-left font-medium text-text-muted px-4 py-3 whitespace-nowrap border-l border-border">
                Assignments
              </th>
            )}
            <th className="text-left font-medium text-text-muted px-4 py-3 whitespace-nowrap">Overall</th>
            <th className="text-left font-medium text-text-muted px-4 py-3 whitespace-nowrap">Last active</th>
          </tr>
        </thead>
        <tbody>
          {gradebook.rows.map((row) => (
            <tr key={row.userId} className="border-t border-border hover:bg-surface-hover">
              <td className="px-4 py-3 sticky left-0 bg-surface z-10">
                <button
                  onClick={() => onOpenStudent(row.userId)}
                  className="text-left hover:text-teal-600 transition-colors"
                >
                  <span className="font-medium text-text-main">{row.fullName}</span>
                  <span className="block text-xs text-text-muted">{row.email}</span>
                </button>
              </td>

              {gradebook.courses.map((c) => {
                const cell = row.cells.find((x) => x.courseId === c.courseId);
                return (
                  <td key={c.courseId} className="px-4 py-3">
                    <ScoreCell cell={cell} />
                  </td>
                );
              })}

              {gradebook.assignments.map((a) => {
                const cell = row.assignments.find((x) => x.classroomAssignmentId === a.classroomAssignmentId);
                return (
                  <td key={a.classroomAssignmentId} className="px-4 py-3 border-l border-border">
                    <SubmissionCell cell={cell} pointsPossible={a.pointsPossible} />
                  </td>
                );
              })}

              {gradebook.assignments.length > 0 && (
                <td className="px-4 py-3 border-l border-border">
                  <ScoreBadge percent={row.assignmentScorePercent} />
                  <div className="text-[11px] text-text-muted mt-1 whitespace-nowrap">
                    {row.assignmentsGraded}/{row.assignmentsSubmitted} marked
                  </div>
                </td>
              )}

              <td className="px-4 py-3">
                <ScoreBadge percent={row.overallScorePercent} />
              </td>
              <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                {row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
};

/**
 * One assignment for one student. A released grade shows the mark; anything else shows the status,
 * because "handed in, not marked yet" and "never started" are the two things an instructor is
 * actually scanning for and a blank cell would merge them.
 */
const SubmissionCell: React.FC<{ cell?: GradebookSubmissionCell; pointsPossible: number }> = ({
  cell,
  pointsPossible,
}) => {
  if (!cell || cell.status === 'not_started') {
    return <span className="text-text-muted whitespace-nowrap">Not started</span>;
  }

  if (cell.pointsAwarded !== null && cell.pointsAwarded !== undefined) {
    const percent = pointsPossible > 0 ? Math.round((100 * cell.pointsAwarded) / pointsPossible) : null;
    return (
      <div className="space-y-1">
        <ScoreBadge percent={percent} />
        <div className="text-[11px] text-text-muted whitespace-nowrap">
          {cell.pointsAwarded}/{pointsPossible}
        </div>
      </div>
    );
  }

  const label: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Handed in',
    late: 'Late',
    graded: 'Graded',
  };

  const tone =
    cell.status === 'late'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-surface-hover text-text-muted';

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${tone}`}>
      {label[cell.status] ?? cell.status}
    </span>
  );
};

const ScoreCell: React.FC<{ cell?: GradebookCell }> = ({ cell }) => {
  if (!cell || (cell.quizSubmissions === 0 && cell.problemsAttempted === 0 && cell.studyMinutes === 0)) {
    return <span className="text-text-muted">Not started</span>;
  }

  return (
    <div className="space-y-1">
      <ScoreBadge percent={cell.averageScorePercent} />
      <div className="text-[11px] text-text-muted">
        {cell.quizSubmissions > 0 && <span>{cell.quizSubmissions} quiz </span>}
        {cell.problemsAttempted > 0 && (
          <span>
            · {cell.problemsCorrect}/{cell.problemsAttempted} problems{' '}
          </span>
        )}
        {cell.studyMinutes > 0 && <span>· {cell.studyMinutes}m</span>}
      </div>
    </div>
  );
};

/** Null percent means "no scored work", which must not look like a zero. */
const ScoreBadge: React.FC<{ percent: number | null }> = ({ percent }) => {
  if (percent === null || percent === undefined) {
    return <span className="text-text-muted">—</span>;
  }

  const tone =
    percent >= 80
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      : percent >= 60
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';

  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>{percent}%</span>;
};

export default GradebookGrid;
