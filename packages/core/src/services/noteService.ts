import type { HttpClient } from '../http';
import type { Note } from '../types';

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

export interface PagedNotes {
  items: Note[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function createNoteService(http: HttpClient) {
  // In-flight dedupe keyed by URL: collapses the concurrent identical fetches that
  // StudyContext's deferred load and the Notes page's own refresh fire on mount.
  const inflightNoteListRequests = new Map<string, Promise<PagedNotes>>();

  return {
    async getAllNotes(page = 1, pageSize = 20): Promise<PagedNotes> {
      const url = `/api/notes?page=${page}&pageSize=${pageSize}`;

      const pending = inflightNoteListRequests.get(url);
      if (pending) return pending;

      const request = http
        .get<{ data: { items: BackendNote[]; totalCount: number; page: number; pageSize: number; totalPages: number } }>(url)
        .then(response => {
          const d = response.data.data;
          return {
            items: d.items.map(mapBackendNote),
            totalCount: d.totalCount,
            page: d.page,
            pageSize: d.pageSize,
            totalPages: d.totalPages,
          };
        })
        .finally(() => inflightNoteListRequests.delete(url));

      inflightNoteListRequests.set(url, request);
      return request;
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

    async deleteNotesBulk(noteIds: string[]): Promise<void> {
      await http.delete('/api/notes/bulk', { data: { noteIds } });
    },
  };
}

export type NoteService = ReturnType<typeof createNoteService>;
