import React, { useState, useMemo, useEffect } from 'react';
import { useStudy } from '../../context/StudyContext';
import { quizSubmissionService, QuizSubmission } from '../../services/documentService';
import { QuizQuestion } from '../../types';
import { getCorrectQuizOptionText, isQuizOptionCorrect, shuffle } from '../../utils/quizAnswers';
import {
  questionBankService,
  QuestionBankQuestion,
  getDifficultyLabel,
} from '../../services/questionBankService';
import { FailedQuestion } from '../../components/quiz/FailedQuestionsTab';
import { MainTab, toQuizQuestion } from './types';

/**
 * Owns the "Review Mistakes" tab: loads every submission plus the question bank,
 * derives the wrong-answer list, applies search/course filtering and builds a
 * retry exam. Data is (re)loaded whenever the failed tab becomes active.
 */
export function useFailedQuizzes(mainTab: MainTab) {
  const { quizSubmissions } = useStudy();

  const [allQuizSubmissions, setAllQuizSubmissions] = useState<QuizSubmission[]>(quizSubmissions);
  const [failedBankQuestions, setFailedBankQuestions] = useState<QuestionBankQuestion[]>([]);
  const [failedLoading, setFailedLoading] = useState(false);
  const [failedSearch, setFailedSearch] = useState('');
  const [failedCourseId, setFailedCourseId] = useState('all');
  const [failedExamQuestions, setFailedExamQuestions] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    if (quizSubmissions.length) setAllQuizSubmissions(quizSubmissions);
  }, [quizSubmissions]);

  const loadAllQuizSubmissions = React.useCallback(async () => {
    const firstPage = await quizSubmissionService.getAllSubmissions(1, 100);
    if (firstPage.totalCount > firstPage.items.length) {
      const fullPage = await quizSubmissionService.getAllSubmissions(1, firstPage.totalCount);
      setAllQuizSubmissions(fullPage.items);
      return fullPage.items;
    }
    setAllQuizSubmissions(firstPage.items);
    return firstPage.items;
  }, []);

  const loadFailedQuizData = React.useCallback(async () => {
    setFailedLoading(true);
    try {
      const [questions] = await Promise.all([
        questionBankService.getQuestions(),
        loadAllQuizSubmissions(),
      ]);
      setFailedBankQuestions(questions);
    } finally {
      setFailedLoading(false);
    }
  }, [loadAllQuizSubmissions]);

  useEffect(() => {
    if (mainTab === 'failed') void loadFailedQuizData();
  }, [mainTab, loadFailedQuizData]);

  const failedQuestions = useMemo<FailedQuestion[]>(() => {
    const byId = new Map(failedBankQuestions.map(question => [question.quizId, question]));

    return allQuizSubmissions.flatMap(submission => {
      const sourceQuestions = failedBankQuestions.filter(question => {
        if (submission.youTubeVideoId || submission.sourceType === 'video') {
          return question.sourceType === 'video' && question.youTubeVideoId === submission.youTubeVideoId;
        }
        return question.sourceType === 'document' && question.documentId === submission.documentId;
      });
      const questionsToCheck = sourceQuestions.length > 0
        ? sourceQuestions
        : Object.keys(submission.answers ?? {})
          .map(id => byId.get(id))
          .filter((question): question is QuestionBankQuestion => !!question);

      return questionsToCheck.flatMap(question => {
        const selectedAnswer = submission.answers?.[question.quizId] ?? '';
        if (selectedAnswer && isQuizOptionCorrect(selectedAnswer, question.correctAnswer)) return [];

        return [{
          question,
          submission,
          selectedAnswer,
          correctAnswer: getCorrectQuizOptionText(question.options, question.correctAnswer),
          sourceName: question.sourceName ?? submission.documentName ?? submission.videoName ?? 'Unknown source',
          courseName: question.courseName,
          courseColor: question.courseColor,
          submittedAt: submission.submittedAt,
        }];
      });
    }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [allQuizSubmissions, failedBankQuestions]);

  const failedFiltered = useMemo(() => {
    const query = failedSearch.trim().toLowerCase();
    return failedQuestions.filter(item => {
      if (failedCourseId !== 'all' && item.question.courseId !== failedCourseId) return false;
      if (!query) return true;
      return [
        item.question.question,
        item.question.explanation,
        item.sourceName,
        item.courseName,
        item.selectedAnswer,
        item.correctAnswer,
        getDifficultyLabel(item.question.difficulty),
        ...item.question.options,
      ].some(value => value?.toLowerCase().includes(query));
    });
  }, [failedQuestions, failedSearch, failedCourseId]);

  const handleStartFailedExam = () => {
    const unique = Array.from(
      new Map(failedFiltered.map(item => [item.question.quizId, item.question])).values(),
    );
    setFailedExamQuestions(shuffle(unique).slice(0, Math.min(50, unique.length)).map(toQuizQuestion));
  };

  return {
    failedLoading, failedSearch, setFailedSearch, failedCourseId, setFailedCourseId,
    failedFiltered, failedExamQuestions, setFailedExamQuestions,
    handleStartFailedExam, loadFailedQuizData,
  };
}
