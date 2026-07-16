import React from 'react';
import { ArrowLeft, Cloud, CloudUpload, Users } from 'lucide-react';
import { useCollaborativeNote } from '../../hooks/useCollaborativeNote';

interface GroupNoteEditorProps {
  noteId: string;
  title: string;
  myName: string;
  onBack: () => void;
}

export const GroupNoteEditor: React.FC<GroupNoteEditorProps> = ({ noteId, title, myName, onBack }) => {
  const { text, setText, peers, connected, saving } = useCollaborativeNote(noteId, myName);
  const others = peers.filter(p => p.name !== myName);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-1 pb-3 border-b border-[var(--border-color)]">
        <button onClick={onBack} className="text-text-muted hover:text-text-main transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h3 className="text-sm font-bold text-text-main truncate flex-1">{title}</h3>

        <div className="flex items-center -space-x-2">
          {others.slice(0, 4).map(p => (
            <span
              key={p.connectionId}
              title={p.name}
              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: p.color }}
            >
              {p.name.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
        {others.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
            <Users size={11} /> {others.length} editing
          </span>
        )}

        <span className="inline-flex items-center gap-1 text-[10px] text-text-muted" title={connected ? 'Connected' : 'Connecting…'}>
          {saving ? <CloudUpload size={12} className="animate-pulse" /> : <Cloud size={12} className={connected ? 'text-emerald-500' : 'text-zinc-300'} />}
          {saving ? 'Saving…' : connected ? 'Synced' : 'Connecting…'}
        </span>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Start typing — everyone in the group sees your edits live…"
        className="flex-1 mt-3 w-full resize-none rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] p-4 text-sm text-text-main leading-relaxed outline-none focus:border-[var(--primary)] transition-colors"
      />
    </div>
  );
};
