import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Trash2, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import studyGroupService, { type Assignment } from '../../services/studyGroupService';
import { cn } from '../../utils/cn';

export const GroupAssignments: React.FC<{ groupId: string; isOwner: boolean }> = ({ groupId, isOwner }) => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = useCallback(() => {
    studyGroupService.getAssignments(groupId)
      .then((res) => setAssignments(res.data?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await studyGroupService.createAssignment(groupId, {
        title: title.trim(),
        description: description.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      setShowCreate(false);
      setTitle(''); setDescription(''); setLinkUrl(''); setDueAt('');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setCreateError(err?.response?.data?.message ?? 'Failed to post assignment.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (a: Assignment) => {
    try {
      const res = await studyGroupService.setAssignmentCompletion(a.id, !a.completedByMe);
      const updated = res.data?.data;
      if (updated) setAssignments((list) => list.map((x) => (x.id === a.id ? updated : x)));
    } catch { /* leave checkbox unchanged */ }
  };

  const handleDelete = async (a: Assignment) => {
    try {
      await studyGroupService.deleteAssignment(a.id);
      setAssignments((list) => list.filter((x) => x.id !== a.id));
    } catch { /* assignment stays on failure */ }
  };

  const overdue = (a: Assignment) => a.dueAt && !a.completedByMe && new Date(a.dueAt) < new Date();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <ClipboardList size={15} className="text-teal-600" />
        <h2 className="text-sm font-semibold text-gray-700">Assignments</h2>
        {isOwner && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="ml-auto p-1.5 rounded-lg text-teal-600 hover:bg-teal-50"
            title="Post assignment"
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      {showCreate && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-2 shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title (e.g. Read chapter 3)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Details (optional)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 resize-none"
          />
          <div className="flex items-center gap-2">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Link (optional, e.g. /quizzes)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="bg-teal-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {creating ? 'Posting…' : 'Post'}
            </button>
          </div>
          {createError && <p className="text-xs text-red-500">{createError}</p>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-2 animate-pulse">
            {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}
          </div>
        ) : assignments.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">
            {isOwner ? 'Post the first assignment for your group.' : 'No assignments yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {assignments.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <button onClick={() => handleToggle(a)} className="shrink-0 mt-0.5" title={a.completedByMe ? 'Mark incomplete' : 'Mark complete'}>
                    {a.completedByMe
                      ? <CheckCircle2 size={18} className="text-green-500" />
                      : <Circle size={18} className="text-gray-300 hover:text-teal-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', a.completedByMe ? 'text-gray-400 line-through' : 'text-text-main')}>
                      {a.title}
                    </p>
                    {a.description && <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {a.dueAt && (
                        <span className={cn('text-[11px]', overdue(a) ? 'text-red-500 font-semibold' : 'text-gray-400')}>
                          due {new Date(a.dueAt).toLocaleDateString()}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">{a.completedCount}/{a.memberCount} done</span>
                      {a.linkUrl && (
                        <button
                          onClick={() => a.linkUrl!.startsWith('/') ? navigate(a.linkUrl!) : window.open(a.linkUrl, '_blank', 'noopener')}
                          className="text-[11px] text-teal-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          <ExternalLink size={10} /> open
                        </button>
                      )}
                    </div>
                    {/* Per-member completion (owner view) */}
                    {isOwner && a.completions.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        Done: {a.completions.map((c) => c.name).join(', ')}
                      </p>
                    )}
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(a)}
                      className="shrink-0 p-1 rounded text-gray-300 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
