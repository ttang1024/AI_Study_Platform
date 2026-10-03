// Service logic moved to the shared package (packages/core). This shim keeps
// rn's historical method names and its `QuizQuestion`
// mapping over the shared web-canonical factory.
import {
  createQuestionBankService,
  type QuestionBankFilters,
  type QuestionBankQuestion,
} from '@core/services/questionBankService';
import { http } from '@/services/http';
import type { QuizQuestion } from '@/types';

export type { QuestionBankFilters };

const core = createQuestionBankService(http);

const mapQuestion = (bq: QuestionBankQuestion): QuizQuestion => ({
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

export const questionBankService = {
  async list(filters: QuestionBankFilters = {}): Promise<QuizQuestion[]> {
    return (await core.getQuestions(filters)).map(mapQuestion);
  },

  /** Wrong answers land in the mistake notebook; correct ones resolve an open entry. */
  recordAttempt: core.recordAttempt,
};
