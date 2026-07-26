// Service logic moved to the shared package (packages/core). This file wires the
// RN HTTP + SSE adapters into the shared factory. RN-local overrides: PickedFile
// uploads (uploadDocument/uploadAudio), SimpleCard flashcard mapping (RN renders
// the lightweight card shape), and generateSummary keeping rn's Document return
// (core's parses the {summary, keyPoints} blob instead).
import { createDocumentService, mapDocument, type BackendDocument } from '@core/services/documentService';
import { normalizeCitation } from '@core/types';
import { apiClient } from '@/services/apiClient';
import { http } from '@/services/http';
import { streamSse } from '@/services/sse';
import type { Document, PickedFile, SimpleCard, SourceCitation } from '@/types';
import { toFormDataPart } from '@/utils/formData';

export * from '@core/services/documentService';

const coreService = createDocumentService(http, streamSse);

interface BackendDocumentFlashcard {
  flashcardId: string;
  front: string;
  back: string;
  cardType?: 'basic' | 'cloze' | 'chart';
  citation?: SourceCitation;
}

const mapDocumentFlashcard = (bf: BackendDocumentFlashcard): SimpleCard => ({
  id: bf.flashcardId,
  front: bf.front,
  back: bf.back,
  cardType: bf.cardType ?? 'basic',
  citation: normalizeCitation(bf.citation),
});

export const documentService = {
  ...coreService,

  async uploadDocument(courseId: string, file: PickedFile): Promise<Document> {
    const formData = new FormData();
    formData.append('file', toFormDataPart(file));
    const response = await apiClient.post(
      `/api/courses/${courseId}/documents/upload?courseId=${courseId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    coreService.invalidateDocumentListCache();
    return mapDocument(response.data.data as BackendDocument);
  },

  async uploadAudio(courseId: string, file: PickedFile): Promise<{ documentId: string }> {
    const formData = new FormData();
    formData.append('file', toFormDataPart(file));
    const response = await apiClient.post(
      `/api/courses/${courseId}/audio/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    coreService.invalidateDocumentListCache();
    return response.data.data;
  },

  async generateSummary(courseId: string, documentId: string): Promise<Document> {
    const response = await apiClient.post(`/api/courses/${courseId}/documents/${documentId}/summary`);
    return mapDocument(response.data.data as BackendDocument);
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
