import { apiClient } from '@/services/apiClient';
import type { PendingMaterial, QuizSubmission } from '@/types';

interface BackendQuizSubmission {
  submissionId: string;
  documentId?: string;
  videoId?: string;
  courseId?: string;
  sourceType: string;
  answers: Record<string, string>;
  score: number;
  total: number;
  submittedAt: string;
  title?: string;
  document?: string;
  video?: string;
}

interface PaginatedSubmissions {
  items: BackendQuizSubmission[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PagedQuizSubmissions {
  items: QuizSubmission[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const mapSubmission = (bs: BackendQuizSubmission): QuizSubmission => ({
  id: bs.submissionId,
  documentId: bs.documentId,
  videoId: bs.videoId,
  courseId: bs.courseId,
  sourceType: bs.sourceType,
  answers: bs.answers,
  score: bs.score,
  total: bs.total,
  submittedAt: bs.submittedAt,
  title: bs.title ?? bs.document ?? bs.video,
});

export const quizHistoryService = {
  async list(page = 1, pageSize = 20): Promise<PagedQuizSubmissions> {
    const response = await apiClient.get(`/api/quiz-submissions?page=${page}&pageSize=${pageSize}`);
    const data = response.data.data as PaginatedSubmissions;
    return {
      items: data.items.map(mapSubmission),
      totalCount: data.totalCount,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    };
  },

  async getCoverage(): Promise<{ documentIds: string[]; videoIds: string[] }> {
    const response = await apiClient.get('/api/quiz-submissions/coverage');
    return response.data.data;
  },

  async getPendingMaterials(): Promise<PendingMaterial[]> {
    const response = await apiClient.get('/api/quiz-submissions/pending-materials');
    return response.data.data as PendingMaterial[];
  },

  async getGeneratedMaterials(): Promise<PendingMaterial[]> {
    const response = await apiClient.get('/api/quiz-submissions/generated-materials');
    return response.data.data as PendingMaterial[];
  },
};
