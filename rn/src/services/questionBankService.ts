import { apiClient } from '@/services/apiClient';
import type { QuizQuestion } from '@/types';

interface BackendQuestionBankQuestion {
  quizId: string;
  documentId?: string;
  videoId?: string;
  courseId?: string;
  sourceType: string;
  sourceName?: string;
  courseName?: string;
  courseColor?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
}

const mapQuestion = (bq: BackendQuestionBankQuestion): QuizQuestion => ({
  id: bq.quizId,
  documentId: bq.documentId,
  videoId: bq.videoId,
  sourceType: bq.sourceType,
  courseId: bq.courseId,
  courseName: bq.courseName,
  courseColor: bq.courseColor,
  sourceName: bq.sourceName,
  question: bq.question,
  options: bq.options,
  correctAnswer: bq.correctAnswer,
  explanation: bq.explanation,
  difficulty: bq.difficulty,
  createdAt: bq.createdAt,
});

export interface QuestionBankFilters {
  courseId?: string;
  sourceType?: 'document' | 'video';
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const questionBankService = {
  async list(filters: QuestionBankFilters = {}): Promise<QuizQuestion[]> {
    const params = new URLSearchParams();
    if (filters.courseId) params.set('courseId', filters.courseId);
    if (filters.sourceType) params.set('sourceType', filters.sourceType);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    const query = params.toString();
    const response = await apiClient.get(`/api/question-bank${query ? `?${query}` : ''}`);
    return (response.data.data as BackendQuestionBankQuestion[]).map(mapQuestion);
  },

  async update(quizId: string, data: { question: string; options: string[]; correctAnswer: string; explanation: string; difficulty: string }): Promise<QuizQuestion> {
    const response = await apiClient.patch(`/api/question-bank/${quizId}`, data);
    return mapQuestion(response.data.data);
  },

  async remove(quizId: string): Promise<void> {
    await apiClient.delete(`/api/question-bank/${quizId}`);
  },

  /** Wrong answers land in the mistake notebook; correct ones resolve an open entry. */
  async recordAttempt(quizId: string, selectedAnswer: string): Promise<{ isCorrect: boolean }> {
    const response = await apiClient.post(`/api/question-bank/${quizId}/attempt`, { selectedAnswer });
    return response.data.data as { isCorrect: boolean };
  },
};
