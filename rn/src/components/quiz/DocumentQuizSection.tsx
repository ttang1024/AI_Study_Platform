import React from 'react';

import { QuizRunner } from '@/components/quiz/QuizRunner';
import { documentService } from '@/services/documentService';

interface DocumentQuizSectionProps {
  courseId: string;
  documentId: string;
}

export const DocumentQuizSection: React.FC<DocumentQuizSectionProps> = ({ courseId, documentId }) => (
  <QuizRunner
    getQuiz={(difficulty) => documentService.getQuiz(courseId, documentId, difficulty)}
    generateQuiz={(difficulty) => documentService.generateQuiz(courseId, documentId, difficulty)}
    submitQuiz={(answers, score, total, confidence) =>
      documentService.saveQuizSubmission(courseId, documentId, answers, score, total, confidence)}
  />
);
