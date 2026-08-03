import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Archive, ArchiveRestore, Copy, Check, RefreshCw, Lock, Unlock } from 'lucide-react';
import { useClassroomDetail } from '../hooks/useClassroomDetail';
import { useClassroomAssignments } from '../hooks/useClassroomAssignments';
import { useAuth } from '../context/AuthContext';
import GradebookGrid from '../components/classrooms/GradebookGrid';
import RosterPanel from '../components/classrooms/RosterPanel';
import AssignedCourses from '../components/classrooms/AssignedCourses';
import AssignmentsPanel from '../components/classrooms/AssignmentsPanel';
import AssignmentDetailPanel from '../components/classrooms/AssignmentDetailPanel';
import StudentProgressPanel from '../components/classrooms/StudentProgressPanel';

type Tab = 'courses' | 'assignments' | 'gradebook' | 'roster' | 'progress';

export const ClassroomDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const {
    detail,
    gradebook,
    studentProgress,
    loading,
    error,
    exporting,
    isGrader,
    canManage,
    assignableCourses,
    openStudent,
    closeStudent,
    exportCsv,
    assignCourse,
    unassignCourse,
    setRole,
    removeMember,
    setArchived,
    rotateJoinCode,
    setEnrollmentOpen,
    addMember,
  } = useClassroomDetail(id);

  const [tab, setTab] = useState<Tab>('courses');
  const [copied, setCopied] = useState(false);

  const assignmentsHook = useClassroomAssignments(id, tab === 'assignments');

  if (loading) return <div className="text-sm text-text-muted">Loading…</div>;
  if (error || !detail) return <div className="text-sm text-red-600">{error || 'Classroom not found.'}</div>;

  const copyJoinCode = async () => {
    if (!detail.joinCode) return;
    await navigator.clipboard.writeText(detail.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Staff read the gradebook, which already contains their own view of every student. A student gets
  // "My progress" instead — the same drill-down the server already authorizes them to fetch for
  // themselves, which until now had no way to reach it from the UI.
  const tabs: Tab[] = isGrader
    ? ['courses', 'assignments', 'gradebook', 'roster']
    : ['courses', 'assignments', 'progress', 'roster'];

  return (
    <div className="space-y-6">
      <Link to="/spaces?tab=classrooms" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-main">
        <ArrowLeft className="w-4 h-4" /> All classrooms
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-main">{detail.name}</h1>
          {detail.description && <p className="text-sm text-text-muted mt-1">{detail.description}</p>}
          {detail.isArchived && (
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-surface-hover text-text-muted">
              Archived — read only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {detail.joinCode && (
            <div className="flex items-center">
              <button
                onClick={() => void copyJoinCode()}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-l-lg border border-border hover:bg-surface-hover font-mono tracking-widest text-sm ${
                  detail.enrollmentOpen ? '' : 'line-through text-text-muted'
                }`}
                title={detail.enrollmentOpen ? 'Copy join code' : 'Enrollment is closed — this code is refused'}
              >
                {detail.joinCode}
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>

              {canManage && !detail.isArchived && (
                <>
                  <button
                    onClick={() => void rotateJoinCode()}
                    className="px-2 py-2 border-y border-border hover:bg-surface-hover text-text-muted hover:text-text-main"
                    title="Issue a new code — the old one stops working"
                    aria-label="Rotate join code"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void setEnrollmentOpen(!detail.enrollmentOpen)}
                    className="px-2 py-2 rounded-r-lg border border-border hover:bg-surface-hover text-text-muted hover:text-text-main"
                    title={detail.enrollmentOpen ? 'Close enrollment' : 'Reopen enrollment'}
                    aria-label={detail.enrollmentOpen ? 'Close enrollment' : 'Reopen enrollment'}
                  >
                    {detail.enrollmentOpen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>
          )}
          {canManage && (
            <button
              onClick={() => void setArchived(!detail.isArchived)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-surface-hover text-sm"
            >
              {detail.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {detail.isArchived ? 'Restore' : 'Archive'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-teal-600 text-teal-600 font-medium'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'courses' && (
        <AssignedCourses
          courses={detail.courses}
          assignableCourses={assignableCourses}
          canManage={canManage && !detail.isArchived}
          onAssign={assignCourse}
          onUnassign={unassignCourse}
        />
      )}

      {tab === 'assignments' && (
        <AssignmentsPanel
          assignments={assignmentsHook.assignments}
          courses={detail.courses}
          isGrader={isGrader}
          canManage={canManage && !detail.isArchived}
          loading={assignmentsHook.loading}
          onOpen={assignmentsHook.openAssignment}
          onCreate={assignmentsHook.createAssignment}
          onUpdate={assignmentsHook.updateAssignment}
          onDelete={assignmentsHook.deleteAssignment}
        />
      )}

      {assignmentsHook.open && (
        <AssignmentDetailPanel
          detail={assignmentsHook.open}
          readOnly={detail.isArchived}
          onClose={assignmentsHook.closeAssignment}
          onSaveSubmission={assignmentsHook.saveSubmission}
          onGrade={assignmentsHook.gradeSubmission}
        />
      )}

      {tab === 'gradebook' &&
        (gradebook ? (
          <GradebookGrid
            gradebook={gradebook}
            onOpenStudent={openStudent}
            onExportCsv={() => void exportCsv()}
            exporting={exporting}
          />
        ) : (
          <p className="text-sm text-text-muted">Loading gradebook…</p>
        ))}

      {tab === 'roster' && (
        <RosterPanel
          detail={detail}
          canManage={canManage && !detail.isArchived}
          currentUserId={user?.id}
          onSetRole={setRole}
          onRemove={removeMember}
          onAddMember={addMember}
        />
      )}

      {tab === 'progress' && (
        <div className="rounded-xl border border-border p-5">
          <p className="text-sm text-text-muted mb-4">
            Your own marks and activity in this classroom. Only you and the teaching staff can see this.
          </p>
          <button
            onClick={() => user?.id && void openStudent(user.id)}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
          >
            View my progress
          </button>
        </div>
      )}

      {studentProgress && <StudentProgressPanel progress={studentProgress} onClose={closeStudent} />}
    </div>
  );
};

export default ClassroomDetailPage;
