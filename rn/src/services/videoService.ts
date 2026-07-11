import { apiClient } from '@/services/apiClient';
import { API_URL } from '@/constants/env';
import { tokenStore } from '@/services/tokenStore';
import type { PickedFile } from '@/types';
import type { VideoSourceType } from '@/constants/videoSources';
import { toFormDataPart } from '@/utils/formData';
import { streamSse } from '@/services/sse';

export interface VideoDetail {
  id: string;
  courseId: string;
  videoId: string;
  videoUrl: string;
  sourceType?: string;
  title: string;
  thumbnailUrl: string;
  summary: string | null;
  createdAt: string;
}

export interface CreateVideoData {
  courseId: string;
  videoId: string;
  videoUrl: string;
  sourceType?: VideoSourceType;
  title: string;
  thumbnailUrl: string;
  summary: null;
}

export interface PlaylistVideoItemData {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  videoUrl?: string;
}

const VIDEO_API = '/api/videos';

export const videoService = {
  async getVideo(id: string): Promise<VideoDetail> {
    const res = await apiClient.get<{ data: VideoDetail }>(`${VIDEO_API}/${id}`);
    return res.data.data;
  },

  async createVideo(data: CreateVideoData): Promise<VideoDetail> {
    const res = await apiClient.post<{ data: VideoDetail }>(VIDEO_API, data);
    return res.data.data;
  },

  /** No thumbnail capture on mobile v1 (web captures a canvas first-frame; no direct RN equivalent). */
  async uploadVideo(courseId: string, file: PickedFile): Promise<VideoDetail> {
    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('file', toFormDataPart(file));
    const res = await apiClient.post<{ data: VideoDetail }>(`${VIDEO_API}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async getVideoMetadata(videoUrl: string): Promise<{ title: string; thumbnailUrl: string } | null> {
    try {
      const res = await apiClient.get<{ data: { title: string; thumbnailUrl: string } }>(
        `${VIDEO_API}/video-metadata?videoUrl=${encodeURIComponent(videoUrl)}`,
      );
      return res.data.data ?? null;
    } catch {
      return null;
    }
  },

  async getBilibiliItems(videoUrl: string): Promise<PlaylistVideoItemData[]> {
    const res = await apiClient.get<{ data: PlaylistVideoItemData[] }>(
      `${VIDEO_API}/bilibili-items?videoUrl=${encodeURIComponent(videoUrl)}`,
    );
    return res.data.data ?? [];
  },

  /** Bearer-token-in-query stream URL for videos uploaded directly (sourceType 'upload'). */
  async getUploadedVideoStreamUrl(videoRecordId: string): Promise<string> {
    const token = await tokenStore.getAccessToken();
    const path = `${VIDEO_API}/${videoRecordId}/file`;
    return token ? `${API_URL}${path}?access_token=${encodeURIComponent(token)}` : `${API_URL}${path}`;
  },

  /** No non-streaming summary endpoint exists for saved videos; consume the SSE stream and let the caller accumulate chunks. */
  async streamSummary(videoRecordId: string, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
    return streamSse(`${VIDEO_API}/${videoRecordId}/summary/stream`, {}, onChunk, signal);
  },
};
