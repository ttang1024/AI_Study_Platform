import { apiClient } from './apiClient';

export interface DocumentAnnotation {
  documentAnnotationId: string;
  documentId: string;
  userId: string;
  highlightedText: string;
  note?: string;
  color: string;
  pageNumber: number;
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

export interface UpdateAnnotationRequest {
  note?: string;
  color: string;
}

const annotationsService = {
  getByDocument: (documentId: string) =>
    apiClient.get<{ data: DocumentAnnotation[] }>(`/api/documents/${documentId}/annotations`),

  create: (documentId: string, data: CreateAnnotationRequest) =>
    apiClient.post<{ data: DocumentAnnotation }>(`/api/documents/${documentId}/annotations`, data),

  update: (id: string, data: UpdateAnnotationRequest) =>
    apiClient.put<{ data: DocumentAnnotation }>(`/api/annotations/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/api/annotations/${id}`),

  createFlashcard: (id: string) =>
    apiClient.post(`/api/annotations/${id}/create-flashcard`),
};

export default annotationsService;
