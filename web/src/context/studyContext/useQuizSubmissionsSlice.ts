import { useCallback, useRef, useState } from 'react';
import { quizSubmissionService, QuizSubmission } from '../../services/documentService';

interface UseQuizSubmissionsSliceArgs {
  isAuthenticated: boolean;
  isLoading: boolean;
}

/** Recent quiz submissions (dashboard + settings export), lazy load-once via ensureQuizSubmissions. */
export function useQuizSubmissionsSlice({ isAuthenticated, isLoading }: UseQuizSubmissionsSliceArgs) {
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);
  const statusRef = useRef<'idle' | 'loading' | 'loaded'>('idle');

  const refreshQuizSubmissions = useCallback(async (): Promise<void> => {
    try {
      const result = await quizSubmissionService.getAllSubmissions(1, 10);
      setQuizSubmissions(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to refresh quiz submissions:', error);
    }
  }, []);

  // Lazy load-once — pulled the first time a reader (dashboard, settings export) mounts,
  // not eagerly on login.
  const ensureQuizSubmissions = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || isLoading) return;
    if (statusRef.current !== 'idle') return;
    statusRef.current = 'loading';
    try {
      const result = await quizSubmissionService.getAllSubmissions(1, 10);
      setQuizSubmissions(result.items);
      statusRef.current = 'loaded';
    } catch (error) {
      console.error('Failed to load quiz submissions:', error);
      statusRef.current = 'idle';
    }
  }, [isAuthenticated, isLoading]);

  /** Lets the load-once guard fire again on the next mount — used on both login and logout. */
  const markIdle = useCallback(() => { statusRef.current = 'idle'; }, []);

  return { quizSubmissions, setQuizSubmissions, refreshQuizSubmissions, ensureQuizSubmissions, markIdle };
}
