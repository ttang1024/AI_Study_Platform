import { apiClient } from '@/services/apiClient';
import type { QuizQuestion, QuizSubmission } from '@/types';

interface BackendQuiz {
  quizId: string;
  documentId?: string;
  videoId?: string;
  sourceType: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  createdAt: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface BackendQuizSubmission {
  submissionId: string;
  documentId?: string;
  videoId?: string;
  sourceType: string;
  answers: Record<string, string>;
  score: number;
  total: number;
  submittedAt: string;
  title?: string;
  document?: string;
  video?: string;
}

const mapQuiz = (bq: BackendQuiz): QuizQuestion => ({
  id: bq.quizId,
  documentId: bq.documentId,
  videoId: bq.videoId,
  sourceType: bq.sourceType,
  question: bq.question,
  options: bq.options,
  correctAnswer: bq.correctAnswer,
  explanation: bq.explanation,
  difficulty: bq.difficulty ?? 'medium',
  createdAt: bq.createdAt,
});

const mapSubmission = (bs: BackendQuizSubmission): QuizSubmission => ({
  id: bs.submissionId,
  documentId: bs.documentId,
  videoId: bs.videoId,
  sourceType: bs.sourceType,
  answers: bs.answers,
  score: bs.score,
  total: bs.total,
  submittedAt: bs.submittedAt,
  title: bs.title ?? bs.document ?? bs.video,
});

type Difficulty = 'easy' | 'medium' | 'hard';

export const quizService = {
  // Document quiz
  async generateForDocument(courseId: string, documentId: string, difficulty: Difficulty): Promise<QuizQuestion[]> {
    const response = await apiClient.post(`/api/courses/${courseId}/documents/${documentId}/quiz/generate?difficulty=${difficulty}`);
    return (response.data.data as BackendQuiz[]).map(mapQuiz);
  },

  async getDocumentQuiz(courseId: string, documentId: string, difficulty?: Difficulty): Promise<QuizQuestion[]> {
    const query = difficulty ? `?difficulty=${difficulty}` : '';
    const response = await apiClient.get(`/api/courses/${courseId}/documents/${documentId}/quiz${query}`);
    return (response.data.data as BackendQuiz[]).map(mapQuiz);
  },

  /**
   * @param confidence Optional {questionId: 1|2|3} self-rating (1 = guessing, 3 = confident). Omitted
   *   when nothing was rated — the server distinguishes "no data" from "rated", so an empty map lies.
   */
  async submitDocumentQuiz(courseId: string, documentId: string, answers: Record<string, string>, score: number, total: number, confidence?: Record<string, number>): Promise<QuizSubmission> {
    const response = await apiClient.post(`/api/courses/${courseId}/documents/${documentId}/quiz/submission`, { answers, score, total, confidence });
    return mapSubmission(response.data.data);
  },

  async getDocumentQuizSubmission(courseId: string, documentId: string): Promise<QuizSubmission | null> {
    const response = await apiClient.get(`/api/courses/${courseId}/documents/${documentId}/quiz/submission`);
    return response.data.data ? mapSubmission(response.data.data) : null;
  },

  // Video quiz
  async generateForVideo(videoId: string, videoUrl: string, difficulty: Difficulty): Promise<QuizQuestion[]> {
    const response = await apiClient.post(`/api/videos/${videoId}/quiz/generate?difficulty=${difficulty}`, { videoUrl });
    return (response.data.data as BackendQuiz[]).map(mapQuiz);
  },

  async getVideoQuiz(videoId: string, difficulty?: Difficulty): Promise<QuizQuestion[]> {
    const query = difficulty ? `?difficulty=${difficulty}` : '';
    const response = await apiClient.get(`/api/videos/${videoId}/quiz${query}`);
    return (response.data.data as BackendQuiz[]).map(mapQuiz);
  },

  // Note: video submissions POST to `/submit`, documents POST to `/submission` — confirmed asymmetry in the backend routes.
  async submitVideoQuiz(videoId: string, answers: Record<string, string>, score: number, total: number, confidence?: Record<string, number>): Promise<QuizSubmission> {
    const response = await apiClient.post(`/api/videos/${videoId}/quiz/submit`, { answers, score, total, confidence });
    return mapSubmission(response.data.data);
  },

  async getVideoQuizSubmission(videoId: string): Promise<QuizSubmission | null> {
    const response = await apiClient.get(`/api/videos/${videoId}/quiz/submission`);
    return response.data.data ? mapSubmission(response.data.data) : null;
  },
};
