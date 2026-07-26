import React from 'react';
import type { Gradebook, GradebookCell } from '../../services/classroomService';

interface Props {
  gradebook: Gradebook;
  onOpenStudent: (userId: string) => void;
}

/**
 * Roster × course grid. Score cells are colour-banded so an instructor can find the students who
 * need help by scanning rather than reading every number.
 */
export const GradebookGrid: React.FC<Props> = ({ gradebook, onOpenStudent }) => {
  if (gradebook.courses.length === 0) {
    return <p className="text-sm text-text-muted">Assign a course to this classroom to start collecting grades.</p>;
  }
  if (gradebook.rows.length === 0) {
    return <p className="text-sm text-text-muted">No students have enrolled yet.</p>;
  }

  return (
    // Wide tables must scroll inside their own container, never the page body.
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
