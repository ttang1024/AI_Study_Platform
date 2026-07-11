import { apiClient } from '@/services/apiClient';

export interface DocumentAnnotation {
  documentAnnotationId: string;
  documentId: string;
  userId: string;
  highlightedText: string;
  note?: string;
  color: string;
  pageNumber: number;
  /** JSON array of page-normalized rects: [{x, y, w, h}] in 0..1 page fractions. */
  rectJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnotationRequest {
  highlightedText: string;
  note?: string;
  color: string;
  pageNumber: number;
  rectJson: string;
}

export const annotationsService = {
  async getByDocument(documentId: string): Promise<DocumentAnnotation[]> {
    const response = await apiClient.get(`/api/documents/${documentId}/annotations`);
    return (response.data.data as DocumentAnnotation[]) ?? [];
  },

  async create(documentId: string, data: CreateAnnotationRequest): Promise<DocumentAnnotation> {
    const response = await apiClient.post(`/api/documents/${documentId}/annotations`, data);
    return response.data.data as DocumentAnnotation;
  },

  async remove(annotationId: string): Promise<void> {
    await apiClient.delete(`/api/annotations/${annotationId}`);
  },

  async createFlashcard(annotationId: string): Promise<void> {
    await apiClient.post(`/api/annotations/${annotationId}/create-flashcard`);
  },
};
