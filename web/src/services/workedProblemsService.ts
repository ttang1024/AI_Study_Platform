import { apiClient } from './apiClient';

export interface ProblemStep {
  stepNumber: number;
  description: string;
  formula?: string;
}

export interface WorkedProblem {
  workedProblemId: string;
  userId: string;
  documentId: string | null;
  youTubeVideoId: string | null;
  problemText: string;
  steps: ProblemStep[];
  finalAnswer: string;
  difficulty: string;
  topic: string | null;
  createdAt: string;
}

export interface ProblemAttempt {
  workedProblemAttemptId: string;
  workedProblemId: string;
  userAnswer: string;
  aiEvaluation: string | null;
  isCorrect: boolean | null;
  attemptedAt: string;
}

export const workedProblemsService = {
  async getProblems(documentId: string): Promise<WorkedProblem[]> {
    const res = await apiClient.get<{ data: WorkedProblem[] }>(`/api/documents/${documentId}/worked-problems`);
    return res.data.data ?? [];
  },

  async generateProblems(documentId: string, difficulty: string, count: number): Promise<WorkedProblem[]> {
    const res = await apiClient.post<{ data: WorkedProblem[] }>(
      `/api/documents/${documentId}/worked-problems/generate`,
      { difficulty, count }
    );
    return res.data.data ?? [];
  },

  async submitAttempt(problemId: string, userAnswer: string): Promise<ProblemAttempt> {
    const res = await apiClient.post<{ data: ProblemAttempt }>(
      `/api/worked-problems/${problemId}/attempt`,
      { userAnswer }
    );
    return res.data.data;
  },

  async getAttempts(problemId: string): Promise<ProblemAttempt[]> {
    const res = await apiClient.get<{ data: ProblemAttempt[] }>(`/api/worked-problems/${problemId}/attempts`);
    return res.data.data ?? [];
  },

  async getVideoProblems(videoId: string): Promise<WorkedProblem[]> {
    const res = await apiClient.get<{ data: WorkedProblem[] }>(`/api/videos/${videoId}/worked-problems`);
    return res.data.data ?? [];
  },

  async generateVideoProblems(videoId: string, difficulty: string, count: number): Promise<WorkedProblem[]> {
    const res = await apiClient.post<{ data: WorkedProblem[] }>(
      `/api/videos/${videoId}/worked-problems/generate`,
      { difficulty, count }
    );
    return res.data.data ?? [];
  },

  async getMastered(): Promise<Set<string>> {
    const res = await apiClient.get<{ data: string[] }>('/api/worked-problems/mastered');
    return new Set(res.data.data ?? []);
  },

  async toggleMastered(problemId: string): Promise<boolean> {
    const res = await apiClient.post<{ data: boolean }>(`/api/worked-problems/mastered/${problemId}`);
    return res.data.data;
  },
};
