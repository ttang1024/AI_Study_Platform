import { apiClient } from './apiClient';

export interface AudioDocument {
  documentId: string;
  courseId: string;
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

function mapAudio(d: any): AudioDocument {
  return {
    documentId: d.documentId,
    courseId: d.courseId,
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

export const audioService = {
  async getAudio(courseId: string, documentId: string): Promise<AudioDocument> {
    const res = await apiClient.get(`/api/courses/${courseId}/audio/${documentId}`);
    return mapAudio(res.data.data);
  },

  async transcribe(courseId: string, documentId: string): Promise<AudioDocument> {
    const res = await apiClient.post(`/api/courses/${courseId}/audio/${documentId}/transcribe`);
    return mapAudio(res.data.data);
  },

  async getAudioUrl(courseId: string, documentId: string): Promise<string> {
    const res = await apiClient.get(`/api/courses/${courseId}/audio/${documentId}/url`);
    return res.data.data as string;
  },

  async getAudioBlobUrl(courseId: string, documentId: string): Promise<string> {
    const res = await apiClient.get(`/api/courses/${courseId}/documents/${documentId}/file`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(res.data);
  },
};
