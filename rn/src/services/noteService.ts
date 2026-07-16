// Service logic moved to the shared package (packages/core). This shim keeps
// rn's historical method names (list/create/update/remove/createForDocument)
// and mapped `Note` returns over the shared web-canonical factory.
import { createNoteService, mapBackendNote, type PagedNotes } from '@core/services/noteService';
import { http } from '@/services/http';
import type { Note } from '@/types';

export type { PagedNotes };

const core = createNoteService(http);

export const noteService = {
  list(page = 1, pageSize = 20): Promise<PagedNotes> {
    return core.getAllNotes(page, pageSize);
  },

  async create(data: { content: string; title?: string; documentId?: string; videoId?: string }): Promise<Note> {
    return mapBackendNote(await core.createNote(data));
  },

  async update(noteId: string, data: { content: string; title?: string }): Promise<Note> {
    return mapBackendNote(await core.updateNote(noteId, data));
  },

  async remove(noteId: string): Promise<void> {
    await core.deleteNote(noteId);
  },

  async createForDocument(courseId: string, documentId: string, content: string): Promise<Note> {
    return mapBackendNote(await core.createNoteForDocument(courseId, documentId, content));
  },
};
