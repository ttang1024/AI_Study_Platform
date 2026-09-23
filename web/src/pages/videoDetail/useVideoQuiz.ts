import { useCallback } from 'react';
import { videoService, type VideoQuizItem } from '../../services/videoService';
import { QuizQuestion } from '../../types';
import { useDifficultyQuiz } from '../../hooks/useDifficultyQuiz';
import type { QuizDifficulty } from './types';

type VideoQuizSubmission = Awaited<ReturnType<typeof videoService.getQuizSubmission>>;

const toQuizQuestion = (q: VideoQuizItem, fallbackDifficulty: QuizDifficulty = 'medium'): QuizQuestion => ({
  id: q.quizId,
  question: q.question,
  options: q.options,
  correctAnswer: q.correctAnswer,
  explanation: q.explanation,
  difficulty: q.difficulty ?? fallbackDifficulty,
} as QuizQuestion);

interface UseVideoQuizArgs {
  id: string | undefined;
  videoUrl: string | null;
  generationDisabled: boolean;
  /** Question id to land on, when arriving via a "review this mistake" deep link. */
  targetQuizQuestionId?: string;
}

/** The video detail page's quiz: useDifficultyQuiz over the video quiz endpoints. */
export function useVideoQuiz({ id, videoUrl, generationDisabled, targetQuizQuestionId }: UseVideoQuizArgs) {
  const generate = useCallback(async (difficulty: QuizDifficulty) => {
    const questions = await videoService.generateQuiz(id!, videoUrl!, difficulty);
    return questions.map(q => toQuizQuestion(q, difficulty));
  }, [id, videoUrl]);

  const saveSubmission = useCallback(async (answers: Record<string, string>, score: number, total: number) => {
    if (id) await videoService.submitQuiz(id, answers, score, total);
  }, [id]);

  const quiz = useDifficultyQuiz({
    canGenerate: !!id && !!videoUrl,
    generationDisabled,
    targetQuizQuestionId,
    generate,
    saveSubmission,
  });

  const { applyLoadedQuiz } = quiz;
  const applyLoadedVideoQuiz = useCallback(
    (questions: VideoQuizItem[] | null, submission: VideoQuizSubmission) =>
      applyLoadedQuiz(questions?.map(q => toQuizQuestion(q)) ?? null, submission),
    [applyLoadedQuiz],
  );

  return { ...quiz, applyLoadedQuiz: applyLoadedVideoQuiz };
}
