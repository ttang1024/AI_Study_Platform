import { apiClient } from './apiClient';

export interface DialogueTurn {
  speaker: 'A' | 'B';
  text: string;
}

export interface AudioOverview {
  id: string;
  courseId: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  audioUrl: string | null;
  durationSeconds: number;
  error: string | null;
  script: DialogueTurn[] | null;
  createdAt: string;
  completedAt: string | null;
}

export const audioOverviewService = {
  async get(courseId: string): Promise<AudioOverview | null> {
    const response = await apiClient.get(`/api/courses/${courseId}/audio-overview`);
    return response.data.data ?? null;
  },

  /** Kicks off generation (script → per-voice TTS → stitched MP3). Idempotent while one is running. */
  async generate(courseId: string): Promise<AudioOverview> {
    const response = await apiClient.post(`/api/courses/${courseId}/audio-overview`);
    return response.data.data;
  },
};
