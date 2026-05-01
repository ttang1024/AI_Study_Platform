import { apiClient } from './apiClient';

export interface OcrDocumentResult {
  documentId: string;
  courseId: string;
  fileName: string;
}

export const ocrService = {
  async uploadImage(file: File, courseId?: string): Promise<OcrDocumentResult> {
    const formData = new FormData();
    formData.append('imageFile', file);
    if (courseId) formData.append('courseId', courseId);

    const response = await apiClient.post('/api/documents/ocr', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return {
      documentId: response.data.data.documentId,
      courseId: response.data.data.courseId,
      fileName: response.data.data.fileName,
    };
  },
};
