import type { HttpClient } from '../http';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionBankQuestion {
  quizId: string;
  documentId?: string;
  videoId?: string;
  courseId?: string;
  sourceType: 'document' | 'video';
  sourceName?: string;
  courseName?: string;
  courseColor?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: QuestionDifficulty;
  createdAt: string;
}

export interface QuestionBankFilters {
  courseId?: string;
  sourceType?: 'document' | 'video';
  difficulty?: QuestionDifficulty;
}

export interface UpdateQuestionBankQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: QuestionDifficulty;
}

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  easy: 'Beginner',
  medium: 'Intermediate',
  hard: 'Advanced',
};

export const getDifficultyLabel = (difficulty: QuestionDifficulty | undefined): string =>
  difficulty ? DIFFICULTY_LABELS[difficulty] : DIFFICULTY_LABELS.medium;

export function createQuestionBankService(http: HttpClient) {
  return {
    async getQuestions(filters: QuestionBankFilters = {}): Promise<QuestionBankQuestion[]> {
      const response = await http.get<{ data: QuestionBankQuestion[] }>('/api/question-bank', {
        params: filters as Record<string, unknown>,
      });
      return response.data.data ?? [];
    },

    async updateQuestion(
      quizId: string,
      payload: UpdateQuestionBankQuestion,
    ): Promise<QuestionBankQuestion> {
      const response = await http.patch<{ data: QuestionBankQuestion }>(
        `/api/question-bank/${quizId}`,
        payload,
      );
      return response.data.data;
    },

    async deleteQuestion(quizId: string): Promise<void> {
      await http.delete(`/api/question-bank/${quizId}`);
    },

    /** Wrong answers land in the mistake notebook; correct ones resolve an open entry. */
    async recordAttempt(quizId: string, selectedAnswer: string): Promise<{ isCorrect: boolean }> {
      const response = await http.post<{ data: { isCorrect: boolean } }>(
        `/api/question-bank/${quizId}/attempt`,
        { selectedAnswer },
      );
      return response.data.data;
    },
  };
}

export type QuestionBankService = ReturnType<typeof createQuestionBankService>;
