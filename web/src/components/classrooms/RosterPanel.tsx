import React from 'react';
import { Trash2 } from 'lucide-react';
import type { ClassroomDetail, ClassroomRole } from '../../services/classroomService';

interface Props {
  detail: ClassroomDetail;
  canManage: boolean;
  currentUserId?: string;
  onSetRole: (userId: string, role: ClassroomRole) => void;
  onRemove: (userId: string) => void;
}

const ROLE_LABELS: Record<ClassroomRole, string> = {
  instructor: 'Instructor',
  assistant: 'Assistant',
  student: 'Student',
};

export const RosterPanel: React.FC<Props> = ({ detail, canManage, currentUserId, onSetRole, onRemove }) => {
  const instructorCount = detail.roster.filter((r) => r.role === 'instructor').length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {detail.roster.map((entry) => {
            // The server refuses to demote or remove the last instructor; disabling the controls
            // here keeps the UI from offering an action that is guaranteed to fail.
            const isLastInstructor = entry.role === 'instructor' && instructorCount <= 1;

            return (
              <tr key={entry.userId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium text-text-main">{entry.fullName}</span>
                  {entry.userId === currentUserId && <span className="text-xs text-text-muted"> (you)</span>}
                  <span className="block text-xs text-text-muted">{entry.email}</span>
                </td>

                <td className="px-4 py-3 w-40">
                  {canManage ? (
                    <select
                      value={entry.role}
                      disabled={isLastInstructor}
                      onChange={(e) => onSetRole(entry.userId, e.target.value as ClassroomRole)}
                      className="w-full px-2 py-1 rounded-lg border border-border bg-surface text-sm disabled:opacity-50"
                      title={isLastInstructor ? 'A classroom must keep at least one instructor.' : undefined}
                    >
                      {(Object.keys(ROLE_LABELS) as ClassroomRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-text-muted">{ROLE_LABELS[entry.role]}</span>
                  )}
                </td>

                <td className="px-4 py-3 w-12 text-right">
                  {canManage && !isLastInstructor && (
                    <button
                      onClick={() => onRemove(entry.userId)}
                      className="text-text-muted hover:text-red-600 transition-colors"
                      aria-label={`Remove ${entry.fullName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RosterPanel;
