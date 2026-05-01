import { apiClient } from './apiClient';

export interface ImportResult {
  importedCount: number;
  fileNames: string[];
}

export const importService = {
  async importMarkdownZip(zipFile: File, courseId?: string): Promise<ImportResult> {
    const form = new FormData();
    form.append('zipFile', zipFile);
    if (courseId) form.append('courseId', courseId);

    const res = await apiClient.post<{ data: ImportResult }>('/api/documents/import/markdown-zip', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async importNotion(zipFile: File, courseId?: string): Promise<ImportResult> {
    const form = new FormData();
    form.append('zipFile', zipFile);
    if (courseId) form.append('courseId', courseId);

    const res = await apiClient.post<{ data: ImportResult }>('/api/documents/import/notion', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};
