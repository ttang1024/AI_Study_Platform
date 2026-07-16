import React, { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react';
import groupNotesService, { type GroupNoteSummary } from '../../services/groupNotesService';
import { GroupNoteEditor } from './GroupNoteEditor';

interface GroupNotesListProps {
  groupId: string;
  myUserId: string;
  myName: string;
}

/** Shared, real-time collaborative notes for a study group (Yjs CRDT over SignalR). */
export const GroupNotesList: React.FC<GroupNotesListProps> = ({ groupId, myUserId, myName }) => {
  const [notes, setNotes] = useState<GroupNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openNote, setOpenNote] = useState<GroupNoteSummary | null>(null);

  const load = () => {
    setLoading(true);
    groupNotesService.listNotes(groupId)
      .then(res => setNotes(res.data.data))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [groupId]);

  const createNote = async () => {
    setCreating(true);
    try {
      const res = await groupNotesService.createNote(groupId, 'Untitled note');
      const note = res.data.data;
      setNotes(prev => [note, ...prev]);
      setOpenNote(note);
    } catch { /* leave list unchanged */ } finally {
      setCreating(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId)); // optimistic
    groupNotesService.deleteNote(noteId).catch(load);
  };

  if (openNote) {
    return (
      <GroupNoteEditor
        noteId={openNote.id}
        title={openNote.title}
        myName={myName}
        onBack={() => { setOpenNote(null); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-muted">Everyone in the group can edit these together, live.</p>
        <button
          onClick={createNote}
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          New note
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-zinc-300" /></div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <FileText size={22} className="text-zinc-300" />
          <p className="text-xs text-text-muted">No shared notes yet — create one to start taking notes together.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div
              key={note.id}
              onClick={() => setOpenNote(note)}
              className="group flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-2.5 cursor-pointer hover:border-[var(--primary)]/40 transition-colors"
            >
              <FileText size={15} className="text-[var(--primary)] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-main truncate">{note.title}</p>
                {note.contentPreview && <p className="text-xs text-text-muted truncate">{note.contentPreview}</p>}
              </div>
              <span className="text-[10px] text-text-muted shrink-0">{new Date(note.updatedAt).toLocaleDateString()}</span>
              {(note.createdBy === myUserId) && (
                <button
                  onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                  className="shrink-0 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete note"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
