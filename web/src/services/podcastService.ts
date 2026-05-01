import { apiClient } from './apiClient';

export interface PodcastEpisode {
  documentId: string;
  courseId: string;
  userId: string;
  fileName: string;
  blobUrl: string;
  contentType: string;
  fileSize: number;
  summary: string | null;
  mindMapText: string | null;
  transcript: string | null;
  originalUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapEpisode(d: any): PodcastEpisode {
  return {
    documentId: d.documentId,
    courseId: d.courseId,
    userId: d.userId,
    fileName: d.fileName,
    blobUrl: d.blobUrl,
    contentType: d.contentType,
    fileSize: d.fileSize,
    summary: d.summary ?? null,
    mindMapText: d.mindMapText ?? null,
    transcript: d.transcript ?? null,
    originalUrl: d.originalUrl ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export const podcastService = {
  async create(applePodcastsUrl: string, courseId: string): Promise<PodcastEpisode> {
    const res = await apiClient.post('/api/podcasts', { applePodcastsUrl, courseId });
    return mapEpisode(res.data.data);
  },

  async getEpisode(documentId: string): Promise<PodcastEpisode> {
    const res = await apiClient.get(`/api/podcasts/${documentId}`);
    return mapEpisode(res.data.data);
  },

  async getAudioUrl(documentId: string): Promise<string> {
    const res = await apiClient.get(`/api/podcasts/${documentId}/url`);
    return res.data.data as string;
  },

  async transcribe(documentId: string): Promise<PodcastEpisode> {
    const res = await apiClient.post(`/api/podcasts/${documentId}/transcribe`);
    return mapEpisode(res.data.data);
  },
};
