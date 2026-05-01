import { apiClient } from './apiClient';
import { Note } from '../types';

interface BackendNote {
  noteId: string;
  documentId?: string;
  youTubeVideoId?: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  document?: string;
  video?: string;
}

const mapNote = (n: BackendNote): Note => ({
  id: n.noteId,
  documentId: n.documentId ?? '',
  youTubeVideoId: n.youTubeVideoId ?? undefined,
  documentName: n.document ?? undefined,
  videoName: n.video ?? undefined,
  content: n.content,
  createdAt: n.createdAt,
});

export interface PagedNotes {
  items: Note[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const noteService = {
  async getAllNotes(page = 1, pageSize = 20): Promise<PagedNotes> {
    const response = await apiClient.get(`/api/notes?page=${page}&pageSize=${pageSize}`);
    const d = response.data.data;
    return {
      items: (d.items as BackendNote[]).map(mapNote),
      totalCount: d.totalCount,
      page: d.page,
      pageSize: d.pageSize,
      totalPages: d.totalPages,
    };
  },

  async createNote(data: { title?: string; content: string }): Promise<BackendNote> {
    const response = await apiClient.post('/api/notes', data);
    return response.data.data;
  },

  async updateNote(noteId: string, data: { title?: string; content: string }): Promise<BackendNote> {
    const response = await apiClient.put(`/api/notes/${noteId}`, data);
    return response.data.data;
  },

  async deleteNote(noteId: string): Promise<void> {
    await apiClient.delete(`/api/notes/${noteId}`);
  },

  async deleteNotesBulk(noteIds: string[]): Promise<void> {
    await apiClient.delete('/api/notes/bulk', { data: { noteIds } });
  },
};
