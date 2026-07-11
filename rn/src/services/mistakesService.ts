import { apiClient } from '@/services/apiClient';
import type { Mistake, VariantQuestion } from '@/types';

export interface Mistakes {
  items: Mistake[];
  openCount: number;
  resolvedCount: number;
}

export const mistakesService = {
  async list(status?: 'open' | 'resolved'): Promise<Mistakes> {
    const query = status ? `?status=${status}` : '';
    const response = await apiClient.get(`/api/mistakes${query}`);
    return response.data.data as Mistakes;
  },

  async setStatus(mistakeId: string, status: 'open' | 'resolved'): Promise<Mistake> {
    const response = await apiClient.post(`/api/mistakes/${mistakeId}/status`, { status });
    return response.data.data as Mistake;
  },

  async remove(mistakeId: string): Promise<void> {
    await apiClient.delete(`/api/mistakes/${mistakeId}`);
  },

  async getVariants(mistakeId: string): Promise<VariantQuestion[]> {
    const response = await apiClient.post(`/api/mistakes/${mistakeId}/variants`);
    return response.data.data as VariantQuestion[];
  },
};
