import { useCallback, useRef, useState } from 'react';
import { Document, Note } from '../../types';
import { documentService } from '../../services/documentService';
import { noteService } from '../../services/noteService';

interface UseNotesSliceArgs {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentDocument: Document | null;
  documents: Document[];
  onNoteCountDelta: (delta: number) => void;
}

/** Recent notes (global search, settings export) plus per-document note CRUD. */
export function useNotesSlice({ isAuthenticated, isLoading, currentDocument, documents, onNoteCountDelta }: UseNotesSliceArgs) {
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const statusRef = useRef<'idle' | 'loading' | 'loaded'>('idle');

  const refreshNotes = useCallback(async (): Promise<void> => {
    try {
      const result = await noteService.getAllNotes(1, 10);
      setAllNotes(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh notes:', error);
    }
  }, []);

  // Lazy load-once for the recent-notes list — used by global search and the settings export.
  // Pulled the first time a reader mounts, not eagerly on login.
  const ensureNotes = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (statusRef.current !== 'idle') return;
    statusRef.current = 'loading';
    try {
      const result = await noteService.getAllNotes(1, 10);
      setAllNotes(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load notes:', error);
      statusRef.current = 'idle';
    }
  }, [isAuthenticated, isLoading]);

  const addNote = async (content: string): Promise<void> => {
    if (!currentDocument) return;
    const newNote = await documentService.createNote(
      currentDocument.courseId || '',
      currentDocument.id,
      content
    );
    setAllNotes((prev) => [newNote, ...prev]);
    onNoteCountDelta(1);
  };

  const deleteNote = async (id: string): Promise<void> => {
    const note = allNotes.find((n) => n.id === id);
    if (!note) return;
    const doc = documents.find((d) => d.id === note.documentId);
    if (!doc) return;
    await documentService.deleteNote(doc.courseId || '', doc.id, id);
    setAllNotes((prev) => prev.filter((n) => n.id !== id));
    onNoteCountDelta(-1);
  };

  const updateNote = async (id: string, content: string): Promise<void> => {
    const note = allNotes.find((n) => n.id === id);
    if (!note) return;
    const doc = documents.find((d) => d.id === note.documentId);
    if (!doc) return;
    const updated = await documentService.updateNote(doc.courseId || '', doc.id, id, content);
    setAllNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
  };

  const markIdle = useCallback(() => { statusRef.current = 'idle'; }, []);

  return { allNotes, setAllNotes, addNote, updateNote, deleteNote, refreshNotes, ensureNotes, markIdle };
}
