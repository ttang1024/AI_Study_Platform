import { apiClient } from './apiClient';

export type NotificationType = 'due' | 'streak' | 'goal' | 'gap' | 'review';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
}

export interface NotificationsResponse {
  items: AppNotification[];
  count: number;
}

export const notificationService = {
  async getNotifications(): Promise<NotificationsResponse> {
    const response = await apiClient.get('/api/notifications');
    return response.data.data;
  },
};
