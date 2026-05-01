import React, { useState } from 'react';
import { Plus, Trash2, Edit3, StickyNote } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';
import { Button } from '../common/Button';
import { RichTextEditor } from '../common/RichTextEditor';

export const NotesList: React.FC = () => {
  const { notes, deleteNote, addNote, updateNote, noteInput, setNoteInput } = useStudy();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleAdd = () => {
    if (!noteInput.trim() || noteInput === '<p></p>') return;
    addNote(noteInput);
    setNoteInput('');
  };

  const handleStartEdit = (note: any) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      updateNote(editingId, editContent);
      setEditingId(null);
      setEditContent('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto no-scrollbar">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <StickyNote size={18} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">New Note</h3>
        </div>
        <div className="space-y-3">
          <RichTextEditor
            content={noteInput}
            onChange={setNoteInput}
            placeholder="Capture a new thought..."
          />
          <Button onClick={handleAdd} className="w-full shadow-sm">
            <Plus size={18} className="mr-2" />
            Add Note
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
          <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Saved Notes</h3>
          <span className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full">
            {notes.length}
          </span>
        </div>

        {notes.map((note) => (
          <div
            key={note.id}
            className="group relative rounded-2xl border border-[var(--border-color)] bg-white p-5 shadow-sm hover:border-[var(--primary)]/30 transition-all"
          >
            {editingId === note.id ? (
              <div className="space-y-3">
                <RichTextEditor
                  content={editContent}
                  onChange={setEditContent}
                  placeholder="Edit your note..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveEdit} size="sm" className="flex-1">Save</Button>
                  <Button onClick={handleCancelEdit} variant="outline" size="sm" className="flex-1">Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="text-sm text-text-main leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: note.content }}
                />
                <div className="mt-4 flex items-center justify-between text-[10px] text-text-muted uppercase tracking-wider font-bold">
                  <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(note)}
                      className="p-1.5 hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                      title="Edit note"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
