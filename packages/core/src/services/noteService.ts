import type { HttpClient } from '../http';
import type { Note } from '../types';
import { mapPaged, type Paged } from '../paged';
import { createRequestCache } from '../requestCache';

export interface BackendNote {
  noteId: string;
  documentId?: string;
  videoId?: string;
  sourceType?: 'document' | 'video';
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  document?: string;
  video?: string;
}

// Superset mapper: web reads id/documentId/names/content/createdAt, rn also
// reads sourceType/title/updatedAt. `documentId ?? ''` keeps web's historical
// shape ('' is falsy, so rn's truthiness checks behave the same).
export const mapBackendNote = (n: BackendNote): Note => ({
  id: n.noteId,
  documentId: n.documentId ?? '',
  videoId: n.videoId ?? undefined,
  documentName: n.document ?? undefined,
  videoName: n.video ?? undefined,
  content: n.content,
  createdAt: n.createdAt,
  sourceType: n.sourceType,
  title: n.title,
  updatedAt: n.updatedAt,
});

export type PagedNotes = Paged<Note>;

export function createNoteService(http: HttpClient) {
  // In-flight dedupe keyed by URL: collapses the concurrent identical fetches that
  // StudyContext's deferred load and the Notes page's own refresh fire on mount.
  const noteListRequests = createRequestCache<PagedNotes>();

  return {
    getAllNotes(page = 1, pageSize = 20): Promise<PagedNotes> {
      const url = `/api/notes?page=${page}&pageSize=${pageSize}`;
      return noteListRequests.get(url, () =>
        http.get<{ data: Paged<BackendNote> }>(url).then(r => mapPaged(r.data.data, mapBackendNote)),
      );
    },

    async createNote(data: {
      title?: string;
      content: string;
      documentId?: string;
      videoId?: string;
    }): Promise<BackendNote> {
      const response = await http.post<{ data: BackendNote }>('/api/notes', data);
      return response.data.data;
    },

    async createNoteForDocument(
      courseId: string,
      documentId: string,
      content: string,
    ): Promise<BackendNote> {
      const response = await http.post<{ data: BackendNote }>(
        `/api/courses/${courseId}/documents/${documentId}/notes`,
        { content },
      );
      return response.data.data;
    },

    async updateNote(noteId: string, data: { title?: string; content: string }): Promise<BackendNote> {
      const response = await http.put<{ data: BackendNote }>(`/api/notes/${noteId}`, data);
      return response.data.data;
    },

    async deleteNote(noteId: string): Promise<void> {
      await http.delete(`/api/notes/${noteId}`);
    },

  };
}

