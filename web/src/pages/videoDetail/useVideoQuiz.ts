import { useCallback, useState } from 'react';
import { videoService, type VideoQuizItem } from '../../services/videoService';
import { QuizQuestion } from '../../types';
import { getApiErrorCode } from '../../utils/apiError';
import { isOptionCorrect } from './helpers';
import type { QuizDifficulty } from './types';

type VideoQuizSubmission = Awaited<ReturnType<typeof videoService.getQuizSubmission>>;

const emptyQuizSets = (): Record<QuizDifficulty, QuizQuestion[]> => ({ easy: [], medium: [], hard: [] });
const emptyAnswerSets = (): Record<QuizDifficulty, Record<string, string>> => ({ easy: {}, medium: {}, hard: {} });
const emptySubmittedSets = (): Record<QuizDifficulty, boolean> => ({ easy: false, medium: false, hard: false });
const emptyScoreSets = (): Record<QuizDifficulty, number> => ({ easy: 0, medium: 0, hard: 0 });

interface UseVideoQuizArgs {
  id: string | undefined;
  videoUrl: string | null;
  generationDisabled: boolean;
  /** Question id to land on, when arriving via a "review this mistake" deep link. */
  targetQuizQuestionId?: string;
}

/** Quiz state (per-difficulty sets), generation, answering and submission for the video detail page. */
export function useVideoQuiz({ id, videoUrl, generationDisabled, targetQuizQuestionId }: UseVideoQuizArgs) {
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

  /** Hydrate from the initial page-load fetch (raw quiz questions + any prior submission). */
  const applyLoadedQuiz = useCallback((
    questions: VideoQuizItem[] | null,
    submission: VideoQuizSubmission,
  ) => {
    let loadedDifficulty: QuizDifficulty = activeQuizDifficulty;
    let loadedSets = emptyQuizSets();

    if (questions) {
      const mapped = questions.map(q => ({
        id: q.quizId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty ?? 'medium',
      } as QuizQuestion));
      const grouped = emptyQuizSets();
      mapped.forEach(q => grouped[(q.difficulty ?? 'medium') as QuizDifficulty].push(q));
      const targetDifficulty = targetQuizQuestionId
        ? (['easy', 'medium', 'hard'] as QuizDifficulty[]).find(difficulty =>
          grouped[difficulty].some(q => q.id === targetQuizQuestionId))
        : undefined;
      loadedDifficulty = targetDifficulty
        ?? (grouped[activeQuizDifficulty].length > 0
          ? activeQuizDifficulty
          : (['easy', 'medium', 'hard'] as QuizDifficulty[]).find(difficulty => grouped[difficulty].length > 0) ?? activeQuizDifficulty);
      loadedSets = grouped;
      setQuizQuestionSets(grouped);
      setActiveQuizDifficulty(loadedDifficulty);
      setQuizQuestions(grouped[loadedDifficulty]);
    }

    if (submission) {
      const submittedDifficulty = (['easy', 'medium', 'hard'] as QuizDifficulty[]).find(difficulty =>
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
    if (!videoUrl || isLoadingQuiz || !id || generationDisabled) return;
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
      const questions = await videoService.generateQuiz(id, videoUrl, difficulty);
      const mapped = questions.map(q => ({
        id: q.quizId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty ?? difficulty,
      } as QuizQuestion));
      setQuizQuestions(mapped);
      setQuizQuestionSets(prev => ({ ...prev, [difficulty]: mapped }));
    } catch (err: any) {
      setQuizError(getApiErrorCode(err));
    } finally {
      setIsLoadingQuiz(false);
    }
  }, [videoUrl, isLoadingQuiz, id, generationDisabled, activeQuizDifficulty]);

  const handleQuizDifficultyChange = useCallback((difficulty: QuizDifficulty) => {
    setActiveQuizDifficulty(difficulty);
    setQuizError(null);
    setQuizQuestions(quizQuestionSets[difficulty]);
    setUserAnswers(quizAnswerSets[difficulty]);
    setIsQuizSubmitted(quizSubmittedSets[difficulty]);
    setQuizScore(quizScoreSets[difficulty]);
  }, [quizQuestionSets, quizAnswerSets, quizSubmittedSets, quizScoreSets]);

  const submitQuiz = useCallback(async () => {
    let score = 0;
    quizQuestions.forEach(q => {
      if (userAnswers[q.id] && isOptionCorrect(userAnswers[q.id], q.correctAnswer)) score++;
    });
    setQuizScore(score);
    setQuizScoreSets(prev => ({ ...prev, [activeQuizDifficulty]: score }));
    setIsQuizSubmitted(true);
    setQuizSubmittedSets(prev => ({ ...prev, [activeQuizDifficulty]: true }));
    if (id) {
      try {
        await videoService.submitQuiz(id, userAnswers, score, quizQuestions.length);
      } catch { }
    }
  }, [quizQuestions, userAnswers, id, activeQuizDifficulty]);

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
