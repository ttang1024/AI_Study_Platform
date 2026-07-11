import type { QuizQuestion } from '@/types';

// Timed Exam is reused by Question Bank ("Mock Exam"), Mistakes ("Retry all open"),
// and document/video quizzes, each of which builds its own in-memory question set.
// A module-level store avoids serializing large question arrays into router params.
let pending: { questions: QuizQuestion[]; title: string } | null = null;

export const examSessionStore = {
  set(questions: QuizQuestion[], title: string) {
    pending = { questions, title };
  },
  take() {
    const value = pending;
    pending = null;
    return value;
  },
};
