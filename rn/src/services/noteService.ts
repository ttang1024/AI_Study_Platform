import { apiClient } from '@/services/apiClient';
import type { Note } from '@/types';

interface BackendNote {
  noteId: string;
  documentId?: string;
  videoId?: string;
  sourceType: 'document' | 'video';
  content: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  document?: string;
  video?: string;
}

interface PaginatedNotes {
  items: BackendNote[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PagedNotes {
  items: Note[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const mapNote = (bn: BackendNote): Note => ({
  id: bn.noteId,
  documentId: bn.documentId,
  videoId: bn.videoId,
  documentName: bn.sourceType === 'document' ? bn.document : undefined,
  videoName: bn.sourceType === 'video' ? bn.video : undefined,
  sourceType: bn.sourceType,
  content: bn.content,
  title: bn.title,
  createdAt: bn.createdAt,
  updatedAt: bn.updatedAt,
});

export const noteService = {
  async list(page = 1, pageSize = 20): Promise<PagedNotes> {
    const response = await apiClient.get(`/api/notes?page=${page}&pageSize=${pageSize}`);
    const data = response.data.data as PaginatedNotes;
    return {
      items: data.items.map(mapNote),
      totalCount: data.totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    };
  },

  async create(data: { content: string; title?: string; documentId?: string; videoId?: string }): Promise<Note> {
    const response = await apiClient.post('/api/notes', data);
    return mapNote(response.data.data);
  },

  async update(noteId: string, data: { content: string; title?: string }): Promise<Note> {
    const response = await apiClient.put(`/api/notes/${noteId}`, data);
    return mapNote(response.data.data);
  },

  async remove(noteId: string): Promise<void> {
    await apiClient.delete(`/api/notes/${noteId}`);
  },

  async createForDocument(courseId: string, documentId: string, content: string): Promise<Note> {
    const response = await apiClient.post(`/api/courses/${courseId}/documents/${documentId}/notes`, { content });
    return mapNote(response.data.data);
  },
};
