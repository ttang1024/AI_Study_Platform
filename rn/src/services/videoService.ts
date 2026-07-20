// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP + SSE adapters into the shared factory. RN-local overrides: PickedFile
// upload, the async token-in-query stream URL (SecureStore token), SimpleCard
// flashcard mapping, and streamSummary keeping rn's record-id semantics (core's
// streamSummary takes a videoUrl; its record-id variant is streamVideoSummary).
import { createVideoService, type VideoDetail, type VideoFlashcard } from '@core/services/videoService';
import { apiClient } from '@/services/apiClient';
import { http } from '@/services/http';
import { streamSse } from '@/services/sse';
import { API_URL } from '@/constants/env';
import { tokenStore } from '@/services/tokenStore';
import type { PickedFile, SimpleCard } from '@/types';
import { toFormDataPart } from '@/utils/formData';

export * from '@core/services/videoService';

const VIDEO_API = '/api/videos';

const coreService = createVideoService(http, streamSse);

const mapVideoFlashcard = (bf: VideoFlashcard): SimpleCard => ({
  id: bf.flashcardId,
  front: bf.front,
  back: bf.back,
  cardType: bf.cardType === 'cloze' || bf.cardType === 'chart' ? bf.cardType : 'basic',
});

export const videoService = {
  ...coreService,

  /** No thumbnail capture on mobile v1 (web captures a canvas first-frame; no direct RN equivalent). */
  async uploadVideo(courseId: string, file: PickedFile): Promise<VideoDetail> {
    const formData = new FormData();
    formData.append('courseId', courseId);
    formData.append('file', toFormDataPart(file));
    const res = await apiClient.post<{ data: VideoDetail }>(`${VIDEO_API}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    coreService.invalidateVideoListCache();
    return res.data.data;
  },

  /** Bearer-token-in-query stream URL for videos uploaded directly (sourceType 'upload'). */
  async getUploadedVideoStreamUrl(videoRecordId: string): Promise<string> {
    const token = await tokenStore.getAccessToken();
    const path = `${VIDEO_API}/${videoRecordId}/file`;
    return token ? `${API_URL}${path}?access_token=${encodeURIComponent(token)}` : `${API_URL}${path}`;
  },

  /** rn's historical name: summary stream for a SAVED video record (core's streamVideoSummary). */
  streamSummary: coreService.streamVideoSummary,

  async getFlashcards(videoId: string): Promise<SimpleCard[]> {
    return (await coreService.getFlashcards(videoId)).map(mapVideoFlashcard);
  },

  async generateFlashcards(videoId: string, videoUrl: string): Promise<SimpleCard[]> {
    return (await coreService.generateFlashcards(videoId, videoUrl)).map(mapVideoFlashcard);
  },
};
