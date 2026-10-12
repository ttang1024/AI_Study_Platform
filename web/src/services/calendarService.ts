import { apiClient } from './apiClient';

export const calendarService = {
  /** The user's study calendar (due reviews + planned sessions) as an .ics download. */
  async downloadIcs(): Promise<Blob> {
    const response = await apiClient.get('/api/calendar/ics', { responseType: 'blob' });
    return response.data;
  },
};
