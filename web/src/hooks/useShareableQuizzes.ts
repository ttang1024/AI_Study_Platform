import { useEffect, useRef, useState } from 'react';
import { documentService } from '../services/documentService';
import { ShareableQuiz } from '../services/shareContentService';

/**
 * Prefetches a document's quiz while the share modal is open, so the modal only offers
 * "include quizzes" when there are some. Returns the modal's `fetchQuizzes` callback, or
 * undefined when the document has no quiz to share.
 */
export function useShareableQuizzes(shareModalOpen: boolean, courseId?: string, documentId?: string) {
  const [available, setAvailable] = useState(false);
  const quizzesRef = useRef<Awaited<ReturnType<typeof documentService.getQuiz>> | null>(null);

  useEffect(() => {
    setAvailable(false);
    quizzesRef.current = null;
  }, [courseId, documentId]);

  useEffect(() => {
    if (!shareModalOpen || !courseId || !documentId) return;
    let cancelled = false;
    documentService.getQuiz(courseId, documentId)
      .then(qs => { if (!cancelled) { quizzesRef.current = qs; setAvailable(qs.length > 0); } })
      .catch(() => { if (!cancelled) { quizzesRef.current = null; setAvailable(false); } });
    return () => { cancelled = true; };
  }, [shareModalOpen, courseId, documentId]);

  if (!courseId || !documentId || !available) return undefined;

  return async (): Promise<ShareableQuiz[]> => {
    const qs = quizzesRef.current ?? await documentService.getQuiz(courseId, documentId);
    return qs.map(q => ({
      question: q.question,
      options: q.options ?? [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation ?? '',
      difficulty: q.difficulty ?? 'medium',
    }));
  };
}
