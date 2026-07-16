import type { HttpClient } from '../http';

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

export interface UpdateAnnotationRequest {
  note?: string;
  color: string;
}

// Returns the raw HttpResponse (callers read `.data.data`), matching the web
// call sites this was extracted from.
export function createAnnotationsService(http: HttpClient) {
  return {
    getByDocument: (documentId: string) =>
      http.get<{ data: DocumentAnnotation[] }>(`/api/documents/${documentId}/annotations`),

    create: (documentId: string, data: CreateAnnotationRequest) =>
      http.post<{ data: DocumentAnnotation }>(`/api/documents/${documentId}/annotations`, data),

    update: (id: string, data: UpdateAnnotationRequest) =>
      http.put<{ data: DocumentAnnotation }>(`/api/annotations/${id}`, data),

    delete: (id: string) => http.delete(`/api/annotations/${id}`),

    createFlashcard: (id: string) => http.post(`/api/annotations/${id}/create-flashcard`),
  };
}

export type AnnotationsService = ReturnType<typeof createAnnotationsService>;
