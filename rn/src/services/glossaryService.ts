import { apiClient } from '@/services/apiClient';
import type { GlossaryTerm } from '@/types';

export const glossaryService = {
  async list(): Promise<GlossaryTerm[]> {
    const response = await apiClient.get('/api/glossary');
    return response.data.data as GlossaryTerm[];
  },

  async getMasteredIds(): Promise<string[]> {
    const response = await apiClient.get('/api/glossary/mastered');
    return response.data.data as string[];
  },

  async toggleMastered(termId: string): Promise<boolean> {
    const response = await apiClient.post(`/api/glossary/mastered/${termId}`);
    return response.data.data as boolean;
  },

  async update(termId: string, data: { term: string; definition: string }): Promise<GlossaryTerm> {
    const response = await apiClient.put(`/api/glossary/terms/${termId}`, data);
    return response.data.data as GlossaryTerm;
  },

  async remove(termId: string): Promise<void> {
    await apiClient.delete(`/api/glossary/terms/${termId}`);
  },

  async generateForDocument(courseId: string, documentId: string): Promise<GlossaryTerm[]> {
    const response = await apiClient.post(`/api/courses/${courseId}/documents/${documentId}/glossary/generate`);
    return response.data.data as GlossaryTerm[];
  },

  async generateForVideo(videoId: string, videoUrl: string): Promise<GlossaryTerm[]> {
    const response = await apiClient.post(`/api/videos/${videoId}/glossary/generate`, { videoUrl });
    return response.data.data as GlossaryTerm[];
  },
};
