import { useCallback, useState } from 'react';
import { getApiErrorCode } from '@core/utils/apiError';
import { isQuizOptionCorrect } from '@core/utils/quizAnswers';
import { QuizQuestion } from '../types';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTIES: QuizDifficulty[] = ['easy', 'medium', 'hard'];

const emptyQuizSets = (): Record<QuizDifficulty, QuizQuestion[]> => ({ easy: [], medium: [], hard: [] });
const emptyAnswerSets = (): Record<QuizDifficulty, Record<string, string>> => ({ easy: {}, medium: {}, hard: {} });
const emptySubmittedSets = (): Record<QuizDifficulty, boolean> => ({ easy: false, medium: false, hard: false });
const emptyScoreSets = (): Record<QuizDifficulty, number> => ({ easy: 0, medium: 0, hard: 0 });

export interface LoadedQuizSubmission {
  answers: Record<string, string>;
  score: number;
}

interface UseDifficultyQuizArgs {
  /** False until the source is ready to generate from (ids resolved, media URL known, …). */
  canGenerate: boolean;
  generationDisabled: boolean;
  /** Question id to land on, when arriving via a "review this mistake" deep link. */
  targetQuizQuestionId?: string;
  generate: (difficulty: QuizDifficulty) => Promise<QuizQuestion[]>;
  saveSubmission: (answers: Record<string, string>, score: number, total: number) => Promise<unknown>;
}

/**
 * Quiz state kept per difficulty (questions, answers, submitted flag, score), plus generation,
 * answering and submission, for the detail pages that drive DocumentQuiz externally.
 */
export function useDifficultyQuiz({
  canGenerate, generationDisabled, targetQuizQuestionId, generate, saveSubmission,
}: UseDifficultyQuizArgs) {
  const [activeQuizDifficulty, setActiveQuizDifficulty] = useState<QuizDifficulty>('medium');
  const [quizQuestionSets, setQuizQuestionSets] = useState<Record<QuizDifficulty, QuizQuestion[]>>(emptyQuizSets);
  const [quizAnswerSets, setQuizAnswerSets] = useState<Record<QuizDifficulty, Record<string, string>>>(emptyAnswerSets);
  const [quizSubmittedSets, setQuizSubmittedSets] = useState<Record<QuizDifficulty, boolean>>(emptySubmittedSets);
  const [quizScoreSets, setQuizScoreSets] = useState<Record<QuizDifficulty, number>>(emptyScoreSets);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizError, setQuizError] = useState<string | null>(null);

  /** Hydrate from the initial page-load fetch (saved questions + any prior submission). */
  const applyLoadedQuiz = useCallback((
    questions: QuizQuestion[] | null,
    submission: LoadedQuizSubmission | null,
  ) => {
    let loadedDifficulty: QuizDifficulty = activeQuizDifficulty;
    let loadedSets = emptyQuizSets();

    if (questions) {
      const grouped = emptyQuizSets();
      questions.forEach(q => grouped[(q.difficulty ?? 'medium') as QuizDifficulty].push(q));
      const targetDifficulty = targetQuizQuestionId
        ? DIFFICULTIES.find(difficulty => grouped[difficulty].some(q => q.id === targetQuizQuestionId))
        : undefined;
      loadedDifficulty = targetDifficulty
        ?? (grouped[activeQuizDifficulty].length > 0
          ? activeQuizDifficulty
          : DIFFICULTIES.find(difficulty => grouped[difficulty].length > 0) ?? activeQuizDifficulty);
      loadedSets = grouped;
      setQuizQuestionSets(grouped);
      setActiveQuizDifficulty(loadedDifficulty);
      setQuizQuestions(grouped[loadedDifficulty]);
    }

    if (submission) {
      const submittedDifficulty = DIFFICULTIES.find(difficulty =>
        Object.keys(submission.answers ?? {}).some(questionId => loadedSets[difficulty].some(q => q.id === questionId)))
        ?? loadedDifficulty;
      setActiveQuizDifficulty(submittedDifficulty);
      setQuizQuestions(loadedSets[submittedDifficulty]);
      setUserAnswers(submission.answers);
      setQuizAnswerSets(prev => ({ ...prev, [submittedDifficulty]: submission.answers }));
      setQuizScore(submission.score);
      setQuizScoreSets(prev => ({ ...prev, [submittedDifficulty]: submission.score }));
      setIsQuizSubmitted(true);
      setQuizSubmittedSets(prev => ({ ...prev, [submittedDifficulty]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetQuizQuestionId]);

  const generateQuiz = useCallback(async (difficulty: QuizDifficulty = activeQuizDifficulty) => {
    if (!canGenerate || isLoadingQuiz || generationDisabled) return;
    setActiveQuizDifficulty(difficulty);
    setQuizError(null);
    setIsLoadingQuiz(true);
    setQuizQuestions([]);
    setQuizQuestionSets(prev => ({ ...prev, [difficulty]: [] }));
    setUserAnswers({});
    setQuizAnswerSets(prev => ({ ...prev, [difficulty]: {} }));
    setIsQuizSubmitted(false);
    setQuizSubmittedSets(prev => ({ ...prev, [difficulty]: false }));
    setQuizScore(0);
    setQuizScoreSets(prev => ({ ...prev, [difficulty]: 0 }));
    try {
      const questions = await generate(difficulty);
      setQuizQuestions(questions);
      setQuizQuestionSets(prev => ({ ...prev, [difficulty]: questions }));
    } catch (err: any) {
      setQuizError(getApiErrorCode(err));
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [canGenerate, isLoadingQuiz, generationDisabled, activeQuizDifficulty, generate]);

  const handleQuizDifficultyChange = useCallback((difficulty: QuizDifficulty) => {
    setActiveQuizDifficulty(difficulty);
    setQuizError(null);
    setQuizQuestions(quizQuestionSets[difficulty]);
    setUserAnswers(quizAnswerSets[difficulty]);
    setIsQuizSubmitted(quizSubmittedSets[difficulty]);
    setQuizScore(quizScoreSets[difficulty]);
  }, [quizQuestionSets, quizAnswerSets, quizSubmittedSets, quizScoreSets]);

  const submitQuiz = useCallback(async () => {
    const score = quizQuestions.filter(q => isQuizOptionCorrect(userAnswers[q.id], q.correctAnswer)).length;
    setQuizScore(score);
    setQuizScoreSets(prev => ({ ...prev, [activeQuizDifficulty]: score }));
    setIsQuizSubmitted(true);
    setQuizSubmittedSets(prev => ({ ...prev, [activeQuizDifficulty]: true }));
    try {
      await saveSubmission(userAnswers, score, quizQuestions.length);
    } catch { }
  }, [quizQuestions, userAnswers, activeQuizDifficulty, saveSubmission]);

  const onAnswerQuiz = (qId: string, option: string) => {
    if (isQuizSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [qId]: option }));
    setQuizAnswerSets(prev => ({
      ...prev,
      [activeQuizDifficulty]: { ...prev[activeQuizDifficulty], [qId]: option },
    }));
  };

  const hasGeneratedQuizzes = Object.values(quizQuestionSets).some(questions => questions.length > 0);

  return {
    activeQuizDifficulty, quizQuestionSets, quizQuestions, userAnswers, isQuizSubmitted,
    quizScore, isLoadingQuiz, quizError, generateQuiz, handleQuizDifficultyChange, submitQuiz, onAnswerQuiz,
    hasGeneratedQuizzes, applyLoadedQuiz,
  };
}
