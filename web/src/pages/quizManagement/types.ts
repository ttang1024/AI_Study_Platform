import { QuizItemType } from '../../components/quiz/QuizItemRow';
import { QuizQuestion, Document } from '../../types';
import { QuestionBankQuestion } from '../../services/questionBankService';

export const PAGE_SIZE = 5;
export const BANK_PAGE_SIZE = 10;

export type MainTab = 'history' | 'failed' | 'bank';

export function docToQuizType(doc: Document | undefined): Exclude<QuizItemType, 'video'> {
  if (doc?.type === 'podcast') return 'podcast';
  if (doc?.type === 'audio') return 'audio';
  if (doc?.originalUrl) return 'article';
  return 'doc';
}

export type DocQuizItem = {
  type: Exclude<QuizItemType, 'video'>;
  id: string;
  name: string;
  score?: number;
  total?: number;
  date?: string;
  courseId?: string;
  courseColor?: string;
  courseName?: string;
  docId?: string;
  targetQuizQuestionId?: string;
  pending?: boolean;
};

export type VideoQuizItem = {
  type: 'video';
  id: string;
  name: string;
  courseId: string;
  courseColor: string;
  courseName: string;
  score?: number;
  total?: number;
  date?: string;
  targetQuizQuestionId?: string;
  pending?: boolean;
};

export type UnifiedQuizItem = DocQuizItem | VideoQuizItem;

export const toQuizQuestion = (q: QuestionBankQuestion): QuizQuestion => ({
  id: q.quizId,
  question: q.question,
  options: q.options,
  correctAnswer: q.correctAnswer,
  explanation: q.explanation,
  type: 'multiple-choice',
  difficulty: q.difficulty,
});
