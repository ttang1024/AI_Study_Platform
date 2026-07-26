import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Archive, ArchiveRestore, Copy, Check } from 'lucide-react';
import { useClassroomDetail } from '../hooks/useClassroomDetail';
import { useAuth } from '../context/AuthContext';
import GradebookGrid from '../components/classrooms/GradebookGrid';
import RosterPanel from '../components/classrooms/RosterPanel';
import AssignedCourses from '../components/classrooms/AssignedCourses';
import StudentProgressPanel from '../components/classrooms/StudentProgressPanel';

type Tab = 'courses' | 'gradebook' | 'roster';

export const ClassroomDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const {
    detail,
    gradebook,
    studentProgress,
    loading,
    error,
    isGrader,
    canManage,
    assignableCourses,
    openStudent,
    closeStudent,
    assignCourse,
    unassignCourse,
    setRole,
    removeMember,
    setArchived,
  } = useClassroomDetail(id);

  const [tab, setTab] = useState<Tab>('courses');
  const [copied, setCopied] = useState(false);

  if (loading) return <div className="text-sm text-text-muted">Loading…</div>;
  if (error || !detail) return <div className="text-sm text-red-600">{error || 'Classroom not found.'}</div>;

  const copyJoinCode = async () => {
    if (!detail.joinCode) return;
    await navigator.clipboard.writeText(detail.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: Tab[] = isGrader ? ['courses', 'gradebook', 'roster'] : ['courses', 'roster'];

  return (
    <div className="space-y-6">
      <Link to="/classrooms" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-main">
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
            <button
              onClick={() => void copyJoinCode()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-surface-hover font-mono tracking-widest text-sm"
              title="Copy join code"
            >
              {detail.joinCode}
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
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

      {tab === 'gradebook' &&
        (gradebook ? (
          <GradebookGrid gradebook={gradebook} onOpenStudent={openStudent} />
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
        />
      )}

      {studentProgress && <StudentProgressPanel progress={studentProgress} onClose={closeStudent} />}
    </div>
  );
};

export default ClassroomDetailPage;
