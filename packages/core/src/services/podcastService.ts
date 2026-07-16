import type { HttpClient } from '../http';

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

export interface PodcastFeedEpisode {
  id: string;
  title: string;
  audioUrl: string;
  link: string;
  description: string;
  thumbnailUrl: string;
  durationMs: number;
  publishedAt: string | null;
}

export interface PodcastFeed {
  title: string;
  thumbnailUrl: string;
  episodes: PodcastFeedEpisode[];
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

export function createPodcastService(http: HttpClient) {
  return {
    /** Create from an episode page URL (Apple Podcasts, Overcast, Castro, …) or a direct audio URL. */
    async create(url: string, courseId: string): Promise<PodcastEpisode> {
      const res = await http.post<{ data: unknown }>('/api/podcasts', { url, courseId });
      return mapEpisode(res.data.data);
    },

    /** List episodes of a podcast RSS feed for the picker. */
    async getFeed(feedUrl: string): Promise<PodcastFeed> {
      const res = await http.get<{ data: PodcastFeed }>('/api/podcasts/feed', { params: { url: feedUrl } });
      return res.data.data;
    },

    /** Create from an episode the user picked out of an RSS feed. */
    async createFromFeed(feedUrl: string, episodeId: string, courseId: string): Promise<PodcastEpisode> {
      const res = await http.post<{ data: unknown }>('/api/podcasts/from-feed', { feedUrl, episodeId, courseId });
      return mapEpisode(res.data.data);
    },

    async getEpisode(documentId: string): Promise<PodcastEpisode> {
      const res = await http.get<{ data: unknown }>(`/api/podcasts/${documentId}`);
      return mapEpisode(res.data.data);
    },

    async getAudioUrl(documentId: string): Promise<string> {
      const res = await http.get<{ data: string }>(`/api/podcasts/${documentId}/url`);
      return res.data.data;
    },

    async transcribe(documentId: string): Promise<PodcastEpisode> {
      const res = await http.post<{ data: unknown }>(`/api/podcasts/${documentId}/transcribe`);
      return mapEpisode(res.data.data);
    },
  };
}

export type PodcastService = ReturnType<typeof createPodcastService>;
