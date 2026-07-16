import { apiClient } from './apiClient';

export interface CalendarFeed {
  id: string;
  name: string;
  url: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface BusyBlock {
  start: string;
  end: string;
  title: string;
  allDay: boolean;
  feedName: string;
}

export interface DayBusySummary {
  date: string;
  busyMinutes: number;
  blocks: BusyBlock[];
}

export const calendarService = {
  async getFeeds(): Promise<CalendarFeed[]> {
    const response = await apiClient.get('/api/calendar/feeds');
    return response.data.data;
  },

  async addFeed(name: string, url: string): Promise<CalendarFeed> {
    const response = await apiClient.post('/api/calendar/feeds', { name, url });
    return response.data.data;
  },

  async removeFeed(feedId: string): Promise<void> {
    await apiClient.delete(`/api/calendar/feeds/${feedId}`);
  },

  /** Busy times per day over [from, to) — ISO dates. Defaults to the next 7 days server-side. */
  async getBusyTimes(from?: string, to?: string): Promise<DayBusySummary[]> {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const response = await apiClient.get(`/api/calendar/busy?${params.toString()}`);
    return response.data.data.days;
  },
};
