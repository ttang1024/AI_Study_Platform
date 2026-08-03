import React from 'react';
import { X } from 'lucide-react';
import type { StudentProgress } from '../../services/classroomService';

interface Props {
  progress: StudentProgress;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'Awaiting mark',
  late: 'Late',
  graded: 'Graded',
};

export const StudentProgressPanel: React.FC<Props> = ({ progress, onClose }) => {
  const peak = Math.max(1, ...progress.studyMinutesTrend.map((d) => d.value));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="w-full max-w-md h-full bg-surface border-l border-border overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-semibold text-text-main">{progress.fullName}</h2>
            <p className="text-xs text-text-muted">{progress.email}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-main" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {progress.assignments.length > 0 && (
          <section className="mb-6">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Assignments</h3>
              {progress.assignmentScorePercent !== null && (
                <span className="text-sm font-medium text-text-main">{progress.assignmentScorePercent}%</span>
              )}
            </div>
            <ul className="space-y-2">
              {progress.assignments.map((a) => {
                const cell = progress.submissions.find(
                  (s) => s.classroomAssignmentId === a.classroomAssignmentId,
                );
                const graded = cell?.pointsAwarded !== null && cell?.pointsAwarded !== undefined;

                return (
                  <li key={a.classroomAssignmentId} className="flex justify-between gap-3 text-sm">
                    <span className="text-text-main truncate">{a.title}</span>
                    <span className={graded ? 'text-text-main whitespace-nowrap' : 'text-text-muted whitespace-nowrap'}>
                      {graded
                        ? `${cell!.pointsAwarded}/${a.pointsPossible}`
                        : STATUS_LABEL[cell?.status ?? 'not_started']}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-2">Weakest topics</h3>
          {progress.weakestTopics.length === 0 ? (
            <p className="text-sm text-text-muted">
              No worked-problem attempts yet — topics appear once this student practises.
            </p>
          ) : (
            <ul className="space-y-2">
              {progress.weakestTopics.map((t) => {
                const pct = t.attempted === 0 ? 0 : Math.round((100 * t.correct) / t.attempted);
                return (
                  <li key={t.topic} className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-main">{t.topic}</span>
                      <span className="text-text-muted">
                        {t.correct}/{t.attempted}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className={pct >= 60 ? 'h-full bg-emerald-500' : 'h-full bg-red-500'}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-2">
            Study minutes, last 30 days
          </h3>
          <div className="flex items-end gap-0.5 h-24" role="img" aria-label="Daily study minutes for the last 30 days">
            {progress.studyMinutesTrend.map((d) => (
              <div
                key={d.date}
                title={`${new Date(d.date).toLocaleDateString()}: ${d.value} min`}
                className="flex-1 bg-teal-500/70 rounded-sm min-h-[2px]"
                style={{ height: `${(d.value / peak) * 100}%` }}
              />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};

export default StudentProgressPanel;
