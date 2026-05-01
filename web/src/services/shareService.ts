import { SharedSet } from '../types';
import { apiClient } from './apiClient';

export const shareService = {
  async createShareToken(documentId?: string, youTubeVideoId?: string): Promise<string> {
    const res = await apiClient.post<{ data: { token: string } }>('/api/flashcards/share', {
      documentId,
      youTubeVideoId,
    });
    return res.data.data.token;
  },

  async getSharedSet(token: string): Promise<SharedSet> {
    const res = await apiClient.get<{ data: SharedSet }>(`/api/shared/${token}`);
    return res.data.data;
  },
};
