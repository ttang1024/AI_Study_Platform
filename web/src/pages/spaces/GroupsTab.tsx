import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, LogIn, X } from 'lucide-react';
import studyGroupService, { type StudyGroup } from '../../services/studyGroupService';

/** The Groups half of /spaces. Group detail still has its own route, /groups/:id. */
export const GroupsTab: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    studyGroupService.getMyGroups()
      .then((res) => setGroups(res.data?.data ?? []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await studyGroupService.create({ name: createName.trim(), description: createDesc.trim() || undefined });
      if (res.data?.data) {
        setGroups((prev) => [res.data.data, ...prev]);
        setShowCreate(false);
        setCreateName('');
        setCreateDesc('');
      }
    } catch {
      setError('Failed to create group.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await studyGroupService.join(inviteCode.trim().toUpperCase());
      if (res.data?.data) {
        setGroups((prev) => [...prev, res.data.data]);
        setShowJoin(false);
        setInviteCode('');
      }
    } catch {
      setError('Invalid invite code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions only — the title and blurb belong to the /spaces shell above the tab bar. */}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => { setShowJoin(true); setShowCreate(false); setError(''); }}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <LogIn size={16} />
          Join Group
        </button>
        <button
          onClick={() => { setShowCreate(true); setShowJoin(false); setError(''); }}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} />
          Create Group
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Create Study Group</h3>
            <button onClick={() => setShowCreate(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Group name..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              autoFocus
            />
            <textarea
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="Description (optional)..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!createName.trim() || submitting}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowCreate(false)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join modal */}
      {showJoin && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Join Study Group</h3>
            <button onClick={() => setShowJoin(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Invite code (e.g. ABC12345)..."
              maxLength={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-300 uppercase"
              autoFocus
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleJoin}
                disabled={inviteCode.length < 6 || submitting}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Joining...' : 'Join'}
              </button>
              <button onClick={() => setShowJoin(false)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Users size={40} className="mb-3 opacity-40" />
          <p className="text-sm">No groups yet. Create one or join with an invite code.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.studyGroupId}
              className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-600 shrink-0">
                  <Users size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{group.name}</h3>
                  {group.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{group.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</span>
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded tracking-widest">{group.inviteCode}</span>
              </div>
              <button
                onClick={() => navigate(`/groups/${group.studyGroupId}`)}
                className="w-full bg-gray-50 hover:bg-teal-50 hover:text-teal-600 text-gray-600 border border-gray-200 rounded-lg py-2 text-xs font-medium transition-colors"
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
