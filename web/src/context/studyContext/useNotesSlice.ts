import { useCallback, useRef, useState } from 'react';
import { Note } from '../../types';
import { mapBackendNote, noteService } from '../../services/noteService';

interface UseNotesSliceArgs {
  isAuthenticated: boolean;
  isLoading: boolean;
  onNoteCountDelta: (delta: number) => void;
}

/** Recent notes (global search, settings export) plus note edit/delete for the Notes page. */
export function useNotesSlice({ isAuthenticated, isLoading, onNoteCountDelta }: UseNotesSliceArgs) {
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

  const deleteNote = async (id: string): Promise<void> => {
    await noteService.deleteNote(id);
    setAllNotes((prev) => prev.filter((n) => n.id !== id));
    onNoteCountDelta(-1);
  };

  const updateNote = async (id: string, content: string): Promise<void> => {
    const updated = mapBackendNote(await noteService.updateNote(id, { content }));
    setAllNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
  };

  const markIdle = useCallback(() => { statusRef.current = 'idle'; }, []);

  return { allNotes, setAllNotes, updateNote, deleteNote, refreshNotes, ensureNotes, markIdle };
}
