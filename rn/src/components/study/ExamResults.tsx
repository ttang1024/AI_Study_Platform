import React from 'react';

import { ExamReview } from '@/components/study/ExamReview';
import type { QuizQuestion } from '@/types';
import { isQuizOptionCorrect } from '@/utils/quizAnswers';

interface ExamResultsProps {
  questions: QuizQuestion[];
  answers: Record<string, string>;
  correctCount: number;
  onClose: () => void;
}

// Client-graded results (timed exam): grade each answer locally, then render
// the shared ExamReview. Server-graded flows (battle, mock exam) build their
// GradedExamItems from the grading response and use ExamReview directly.
export const ExamResults: React.FC<ExamResultsProps> = ({ questions, answers, correctCount, onClose }) => (
  <ExamReview
    score={correctCount}
    total={questions.length}
    subtitle={`${Math.round((correctCount / questions.length) * 100)}% correct`}
    items={questions.map((q) => {
      const userAnswer = answers[q.id];
      return {
        key: q.id,
        question: q.question,
        userAnswer,
        correct: !!userAnswer && isQuizOptionCorrect(userAnswer, q.correctAnswer),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      };
    })}
    closeTitle="Close"
    onClose={onClose}
  />
);
