import { apiClient } from '@/services/apiClient';

export interface ProblemStep {
  stepNumber: number;
  description: string;
  formula?: string;
}

export interface WorkedProblem {
  workedProblemId: string;
  documentId?: string;
  videoId?: string;
  problemText: string;
  steps: ProblemStep[];
  finalAnswer: string;
  difficulty: string;
  topic?: string;
  createdAt: string;
}

export interface WorkedProblemAttempt {
  workedProblemAttemptId: string;
  workedProblemId: string;
  userAnswer: string;
  aiEvaluation?: string;
  isCorrect?: boolean;
  attemptedAt: string;
}

type Difficulty = 'easy' | 'medium' | 'hard';

export const workedProblemsService = {
  // Note: unlike quiz/notes/glossary, document worked-problems has no /api/courses/{courseId} prefix.
  async getForDocument(documentId: string): Promise<WorkedProblem[]> {
    const res = await apiClient.get<{ data: WorkedProblem[] }>(`/api/documents/${documentId}/worked-problems`);
    return res.data.data ?? [];
  },

  async generateForDocument(documentId: string, difficulty: Difficulty, count: number): Promise<WorkedProblem[]> {
    const res = await apiClient.post<{ data: WorkedProblem[] }>(`/api/documents/${documentId}/worked-problems/generate`, { difficulty, count });
    return res.data.data ?? [];
  },

  async getForVideo(videoId: string): Promise<WorkedProblem[]> {
    const res = await apiClient.get<{ data: WorkedProblem[] }>(`/api/videos/${videoId}/worked-problems`);
    return res.data.data ?? [];
  },

  async generateForVideo(videoId: string, difficulty: Difficulty, count: number): Promise<WorkedProblem[]> {
    const res = await apiClient.post<{ data: WorkedProblem[] }>(`/api/videos/${videoId}/worked-problems/generate`, { difficulty, count });
    return res.data.data ?? [];
  },

  async submitAttempt(problemId: string, userAnswer: string): Promise<WorkedProblemAttempt> {
    const res = await apiClient.post<{ data: WorkedProblemAttempt }>(`/api/worked-problems/${problemId}/attempt`, { userAnswer });
    return res.data.data;
  },
};
