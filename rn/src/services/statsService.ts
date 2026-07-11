import { apiClient } from '@/services/apiClient';
import type { UserStats, UserXp } from '@/types';

export const statsService = {
  async getUserStats(): Promise<UserStats> {
    const response = await apiClient.get('/api/stats');
    return response.data.data as UserStats;
  },

  async getXp(): Promise<UserXp> {
    const response = await apiClient.get('/api/stats/xp');
    return response.data.data as UserXp;
  },
};
