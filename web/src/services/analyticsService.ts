import { apiClient } from './apiClient';

interface QuizAccuracyData {
  date: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercentage: number;
}

export const analyticsService = {
  async getQuizAccuracy(from?: string, to?: string): Promise<QuizAccuracyData[]> {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const response = await apiClient.get(`/api/analytics/quiz-accuracy?${params.toString()}`);
    return response.data.data;
  },
};
