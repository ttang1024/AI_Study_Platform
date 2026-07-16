import { apiClient } from '@/services/apiClient';
import { streamSse } from '@/services/sse';
import type { Document, PickedFile, SimpleCard } from '@/types';
import { toFormDataPart } from '@/utils/formData';

interface BackendDocument {
  documentId: string;
  courseId: string;
  fileName: string;
  blobUrl: string;
  contentType: string;
  originalUrl?: string;
  summary?: string;
  mindMapText?: string | null;
  createdAt: string;
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.m4b', '.wav', '.ogg', '.aac', '.flac', '.webm', '.opus', '.aiff', '.aif', '.wma', '.amr', '.mka'];

const getDocumentType = (contentType: string, fileName: string): Document['type'] => {
  const name = fileName.toLowerCase();
  if (contentType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (contentType.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx';
  if (contentType === 'text/markdown' || name.endsWith('.md')) return 'md';
  if (contentType === 'audio/podcast') return 'podcast';
  if (contentType.startsWith('audio/') || AUDIO_EXTENSIONS.some((e) => name.endsWith(e))) return 'audio';
  return 'txt';
};

const mapDocument = (bd: BackendDocument): Document => ({
  id: bd.documentId,
  name: bd.fileName,
  type: getDocumentType(bd.contentType, bd.fileName),
  url: bd.blobUrl,
  uploadDate: bd.createdAt,
  courseId: bd.courseId,
  summary: bd.summary,
  originalUrl: bd.originalUrl,
  mindMapText: bd.mindMapText,
});

export const documentService = {
  async getDocument(courseId: string, documentId: string): Promise<Document> {
    const response = await apiClient.get(`/api/courses/${courseId}/documents/${documentId}`);
    return mapDocument(response.data.data);
  },

  // doc.url is the raw storage URI (e.g. s3://...) and isn't directly openable
  // by Linking.openURL or the audio player — this exchanges it for a short-lived
  // presigned HTTP(S) URL.
  async getDownloadUrl(courseId: string, documentId: string): Promise<string> {
    const response = await apiClient.get(`/api/courses/${courseId}/documents/${documentId}/download-url`);
    return response.data.data;
  },

  async uploadDocument(courseId: string, file: PickedFile): Promise<Document> {
    const formData = new FormData();
    formData.append('file', toFormDataPart(file));
    const response = await apiClient.post(
      `/api/courses/${courseId}/documents/upload?courseId=${courseId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return mapDocument(response.data.data);
  },

  async clipUrl(url: string, courseId: string): Promise<{ documentId: string; courseId: string }> {
    const response = await apiClient.post('/api/documents/clip-url', { url, courseId });
    return response.data.data;
  },

  async deleteDocument(courseId: string, documentId: string): Promise<void> {
    await apiClient.delete(`/api/courses/${courseId}/documents/${documentId}`);
  },

  async uploadAudio(courseId: string, file: PickedFile): Promise<{ documentId: string }> {
    const formData = new FormData();
    formData.append('file', toFormDataPart(file));
    const response = await apiClient.post(
      `/api/courses/${courseId}/audio/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data.data;
  },

  async generateSummary(courseId: string, documentId: string): Promise<Document> {
    const response = await apiClient.post(`/api/courses/${courseId}/documents/${documentId}/summary`);
    return mapDocument(response.data.data);
  },

  async updateMindMap(courseId: string, documentId: string, mindMapText: string): Promise<Document> {
    const response = await apiClient.patch(`/api/courses/${courseId}/documents/${documentId}/content`, { mindMapText });
    return mapDocument(response.data.data);
  },

  async streamMindMap(
    courseId: string,
    documentId: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return streamSse(`/api/courses/${courseId}/documents/${documentId}/mindmap/stream`, {}, onChunk, signal);
  },

  async getFlashcards(courseId: string, documentId: string): Promise<SimpleCard[]> {
    const response = await apiClient.get(`/api/courses/${courseId}/documents/${documentId}/flashcards`);
    return (response.data.data as BackendDocumentFlashcard[]).map(mapDocumentFlashcard);
  },

  async generateFlashcards(courseId: string, documentId: string): Promise<SimpleCard[]> {
    const response = await apiClient.post(`/api/courses/${courseId}/documents/${documentId}/flashcards/generate`);
    return (response.data.data as BackendDocumentFlashcard[]).map(mapDocumentFlashcard);
  },
};

interface BackendDocumentFlashcard {
  flashcardId: string;
  front: string;
  back: string;
  cardType?: 'basic' | 'cloze' | 'chart';
}

const mapDocumentFlashcard = (bf: BackendDocumentFlashcard): SimpleCard => ({
  id: bf.flashcardId,
  front: bf.front,
  back: bf.back,
  cardType: bf.cardType ?? 'basic',
});
