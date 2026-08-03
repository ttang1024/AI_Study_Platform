import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Plus, LogIn, Building2, X, CalendarClock } from 'lucide-react';
import classroomService, {
  type Classroom,
  type ClassroomDeadline,
  type Organization,
} from '../../services/classroomService';

/** The Classrooms half of /spaces. Classroom detail still has its own route, /classrooms/:id. */
export const ClassroomsTab: React.FC = () => {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [deadlines, setDeadlines] = useState<ClassroomDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'join' | 'org' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ name: '', description: '', organizationId: '', joinCode: '', orgName: '' });
  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    const [c, o, d] = await Promise.allSettled([
      classroomService.getMyClassrooms(),
      classroomService.getMyOrganizations(),
      classroomService.getDeadlines(),
    ]);
    if (c.status === 'fulfilled') setClassrooms(c.value.data?.data ?? []);
    if (o.status === 'fulfilled') setOrganizations(o.value.data?.data ?? []);
    if (d.status === 'fulfilled') setDeadlines(d.value.data?.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeModal = () => {
    setModal(null);
    setError('');
    setForm({ name: '', description: '', organizationId: '', joinCode: '', orgName: '' });
  };

  const handleCreateOrg = async () => {
    if (!form.orgName.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await classroomService.createOrganization(form.orgName.trim());
      const created = res.data?.data;
      if (created) {
        setOrganizations((prev) => [created, ...prev]);
        // Roll straight into creating a classroom — an organization with none is not useful yet.
        setForm({ name: '', description: '', organizationId: created.organizationId, joinCode: '', orgName: '' });
        setModal('create');
      }
    } catch {
      setError('Could not create that organization.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.organizationId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await classroomService.createClassroom({
        organizationId: form.organizationId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      });
      if (res.data?.data) {
        setClassrooms((prev) => [res.data.data, ...prev]);
        closeModal();
      }
    } catch {
      setError('Could not create that classroom.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!form.joinCode.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await classroomService.joinClassroom(form.joinCode.trim().toUpperCase());
      if (res.data?.data) {
        setClassrooms((prev) => [...prev, res.data.data]);
        closeModal();
      }
    } catch {
      setError('That join code is not valid, or you are already enrolled.');
    } finally {
      setSubmitting(false);
    }
  };

  const teaching = classrooms.filter((c) => c.myRole !== 'student');
  const enrolled = classrooms.filter((c) => c.myRole === 'student');

  return (
    <div className="space-y-6">
      {/* Actions only — the title and blurb belong to the /spaces shell above the tab bar. */}
      {/* text-sm/font-medium keeps these the same height as the Study groups tab's actions. */}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => setModal('join')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-main text-sm font-medium hover:bg-surface-hover transition-colors"
        >
          <LogIn className="w-4 h-4" /> Join a class
        </button>
        <button
          onClick={() => setModal(organizations.length ? 'create' : 'org')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New classroom
        </button>
      </div>

      {loading ? (
        <div className="text-text-muted text-sm">Loading…</div>
      ) : classrooms.length === 0 ? (
        <EmptyState onJoin={() => setModal('join')} onCreate={() => setModal(organizations.length ? 'create' : 'org')} />
      ) : (
        <div className="space-y-8">
          {deadlines.length > 0 && (
            <DueSoon deadlines={deadlines} onOpen={(id) => navigate(`/classrooms/${id}`)} />
          )}
          {teaching.length > 0 && (
            <Section title="Teaching" classrooms={teaching} onOpen={(id) => navigate(`/classrooms/${id}`)} />
          )}
          {enrolled.length > 0 && (
            <Section title="Enrolled" classrooms={enrolled} onOpen={(id) => navigate(`/classrooms/${id}`)} />
          )}
        </div>
      )}

      {modal && (
        <Modal
          title={modal === 'join' ? 'Join a classroom' : modal === 'org' ? 'Create an organization' : 'New classroom'}
          onClose={closeModal}
        >
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {modal === 'join' && (
            <>
              <label className="block text-sm text-text-muted mb-1">Join code</label>
              <input
                value={form.joinCode}
                onChange={(e) => update({ joinCode: e.target.value.toUpperCase() })}
                placeholder="ABCD2345"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface font-mono tracking-widest"
              />
              <ModalActions
                submitting={submitting}
                onCancel={closeModal}
                onConfirm={handleJoin}
                confirmLabel="Join"
                disabled={!form.joinCode.trim()}
              />
            </>
          )}

          {modal === 'org' && (
            <>
              <p className="text-sm text-text-muted mb-3">
                Classrooms belong to an organization — a school, department, or course group. You will be its owner.
              </p>
              <label className="block text-sm text-text-muted mb-1">Organization name</label>
              <input
                value={form.orgName}
                onChange={(e) => update({ orgName: e.target.value })}
                placeholder="Riverside High School"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
              />
              <ModalActions
                submitting={submitting}
                onCancel={closeModal}
                onConfirm={handleCreateOrg}
                confirmLabel="Continue"
                disabled={!form.orgName.trim()}
              />
            </>
          )}

          {modal === 'create' && (
            <>
              <label className="block text-sm text-text-muted mb-1">Organization</label>
              <select
                value={form.organizationId}
                onChange={(e) => update({ organizationId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface mb-3"
              >
                <option value="">Select…</option>
                {organizations
                  .filter((o) => o.myRole !== 'member')
                  .map((o) => (
                    <option key={o.organizationId} value={o.organizationId}>
                      {o.name}
                    </option>
                  ))}
              </select>

              <label className="block text-sm text-text-muted mb-1">Classroom name</label>
              <input
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Physics 101 — Fall"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface mb-3"
              />

              <label className="block text-sm text-text-muted mb-1">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface"
              />

              <ModalActions
                submitting={submitting}
                onCancel={closeModal}
                onConfirm={handleCreate}
                confirmLabel="Create"
                disabled={!form.name.trim() || !form.organizationId}
              />
            </>
          )}
        </Modal>
      )}
    </div>
  );
};

/**
 * Outstanding classwork across every enrolled classroom. Sits above the classroom cards because a
 * deadline is the one thing on this page that expires — the classrooms themselves will still be
 * there tomorrow.
 */
const DueSoon: React.FC<{ deadlines: ClassroomDeadline[]; onOpen: (id: string) => void }> = ({
  deadlines,
  onOpen,
}) => (
  <div>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">Due soon</h2>
    <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
      {deadlines.map((d) => (
        <li key={`${d.classroomAssignmentId ?? d.courseId}-${d.dueAt}`}>
          <button
            onClick={() => onOpen(d.classroomId)}
            className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 bg-surface hover:bg-surface-hover transition-colors"
          >
            <span className="flex items-center gap-3 min-w-0">
              <CalendarClock
                className={`w-4 h-4 shrink-0 ${d.isOverdue ? 'text-red-600' : 'text-teal-600'}`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-main truncate">{d.title}</span>
                <span className="block text-xs text-text-muted truncate">{d.classroomName}</span>
              </span>
            </span>
            <span
              className={`text-xs whitespace-nowrap ${d.isOverdue ? 'text-red-600 font-medium' : 'text-text-muted'}`}
            >
              {d.isOverdue ? 'Overdue · ' : ''}
              {new Date(d.dueAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </button>
        </li>
      ))}
    </ul>
  </div>
);

const Section: React.FC<{ title: string; classrooms: Classroom[]; onOpen: (id: string) => void }> = ({
  title,
  classrooms,
  onOpen,
}) => (
  <div>
    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted mb-3">{title}</h2>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {classrooms.map((c) => (
        <button
          key={c.classroomId}
          onClick={() => onOpen(c.classroomId)}
          className="text-left p-5 rounded-xl border border-border bg-surface hover:border-teal-500 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <GraduationCap className="w-5 h-5 text-teal-600 shrink-0" />
            {c.isArchived && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-hover text-text-muted">Archived</span>
            )}
          </div>
          <h3 className="mt-3 font-semibold text-text-main">{c.name}</h3>
          <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> {c.organizationName}
          </p>
          <p className="text-xs text-text-muted mt-3">
            {c.studentCount} student{c.studentCount === 1 ? '' : 's'} · {c.courseCount} course
            {c.courseCount === 1 ? '' : 's'}
          </p>
        </button>
      ))}
    </div>
  </div>
);

const EmptyState: React.FC<{ onJoin: () => void; onCreate: () => void }> = ({ onJoin, onCreate }) => (
  <div className="text-center py-16 rounded-xl border border-dashed border-border">
    <GraduationCap className="w-10 h-10 text-text-muted mx-auto" />
    <h2 className="mt-4 font-semibold text-text-main">No classrooms yet</h2>
    <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">
      Students: enter the join code your instructor gave you. Instructors: create a classroom and assign courses from
      your library.
    </p>
    <div className="mt-5 flex gap-2 justify-center">
      <button onClick={onJoin} className="px-4 py-2 rounded-lg border border-border hover:bg-surface-hover">
        Join a class
      </button>
      <button onClick={onCreate} className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700">
        Create a classroom
      </button>
    </div>
  </div>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="w-full max-w-md rounded-xl bg-surface border border-border p-6" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-main">{title}</h2>
        <button onClick={onClose} className="text-text-muted hover:text-text-main">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const ModalActions: React.FC<{
  submitting: boolean;
  disabled?: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ submitting, disabled, confirmLabel, onCancel, onConfirm }) => (
  <div className="flex justify-end gap-2 mt-5">
    <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-border hover:bg-surface-hover">
      Cancel
    </button>
    <button
      onClick={onConfirm}
      disabled={submitting || disabled}
      className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
    >
      {submitting ? 'Working…' : confirmLabel}
    </button>
  </div>
);

export default ClassroomsTab;
