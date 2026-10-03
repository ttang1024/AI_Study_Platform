import { useCallback, useEffect, useState } from 'react';
import { documentService } from '../services/documentService';

/**
 * The single note attached to a document: loads it when the document changes and
 * saves edits back, creating the note on first save.
 */
export function useDocumentNote(courseId?: string, documentId?: string) {
  const [noteContent, setNoteContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId || !documentId) return;
    setNoteId(null);
    setNoteContent('');
    documentService.getNotes(courseId, documentId)
      .then(notes => {
        if (notes.length > 0) {
          setNoteId(notes[0].id);
          setNoteContent(notes[0].content);
        }
      })
      .catch(() => { });
  }, [documentId, courseId]);

  const saveNote = useCallback(async (html: string) => {
    if (!courseId || !documentId) return;
    setNoteContent(html);
    try {
      if (noteId) {
        await documentService.updateNote(courseId, documentId, noteId, html);
      } else {
        const note = await documentService.createNote(courseId, documentId, html);
        setNoteId(note.id);
      }
    } catch { }
  }, [courseId, documentId, noteId]);

  return { noteContent, saveNote };
}
