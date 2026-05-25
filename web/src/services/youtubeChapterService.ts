import { apiClient } from './apiClient';

export interface YouTubeChapter {
  youTubeChapterId: string;
  youTubeVideoId: string;
  timestampSeconds: number;
  title: string;
  summaryText: string | null;
  createdAt: string;
}

export const youtubeChapterService = {
  async getChapters(videoId: string): Promise<YouTubeChapter[]> {
    const res = await apiClient.get<{ data: YouTubeChapter[] }>(`/api/videos/${videoId}/chapters`);
    return res.data.data ?? [];
  },

  async generateChapters(videoId: string): Promise<YouTubeChapter[]> {
    const res = await apiClient.post<{ data: YouTubeChapter[] }>(`/api/videos/${videoId}/chapters/generate`);
    return res.data.data ?? [];
  },
};
