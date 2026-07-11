import { apiClient } from '@/services/apiClient';
import type { WeeklyDigest } from '@/types';

export const notificationService = {
  async getWeeklyDigest(): Promise<WeeklyDigest> {
    const response = await apiClient.get('/api/notifications/weekly-digest');
    return response.data.data as WeeklyDigest;
  },
};
