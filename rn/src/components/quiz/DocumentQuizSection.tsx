import React from 'react';

import { QuizRunner } from '@/components/quiz/QuizRunner';
import { quizService } from '@/services/quizService';

interface DocumentQuizSectionProps {
  courseId: string;
  documentId: string;
}

export const DocumentQuizSection: React.FC<DocumentQuizSectionProps> = ({ courseId, documentId }) => (
  <QuizRunner
    getQuiz={(difficulty) => quizService.getDocumentQuiz(courseId, documentId, difficulty)}
    generateQuiz={(difficulty) => quizService.generateForDocument(courseId, documentId, difficulty)}
    submitQuiz={(answers, score, total) => quizService.submitDocumentQuiz(courseId, documentId, answers, score, total)}
  />
);
