import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flashcard } from '../../types';
import { SessionRating } from '../study/FlashcardSessionCard';
import { workedProblemsService } from '../../services/workedProblemsService';
import { quizSubmissionService, QuizSubmission } from '../../services/documentService';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';
import { masteredService } from '../../services/masteredService';
import { CourseArtifacts, CourseStudySelected } from './artifactsWorkspaceModel';

export type FlashcardDifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';
export type QuestionFilter = 'all' | 'mistakes';
export type MasteredFilter = 'all' | 'unmastered';

/**
 * Everything about narrowing the artifact lists: the source filter (all vs the
 * selected material), the per-section filters (difficulty / mistakes / mastered),
 * and the server state those filters need (quiz submissions, mastered id sets).
 */
export function useArtifactFilters(
  artifacts: CourseArtifacts,
  artifactFilter: 'all' | 'current',
  selected: CourseStudySelected,
  userId: string,
) {
  const [flashcardDifficultyFilter, setFlashcardDifficultyFilter] = useState<FlashcardDifficultyFilter>('all');
  const [flashcardDifficultyOverrides, setFlashcardDifficultyOverrides] = useState<Map<string, Flashcard['difficulty']>>(new Map());

  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>('all');
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);

  const [glossaryFilter, setGlossaryFilter] = useState<MasteredFilter>('all');
  const [masteredIds, setMasteredIds] = useState<Set<string>>(() => masteredService.getCached(userId));
  const [togglingGlossaryId, setTogglingGlossaryId] = useState<string | null>(null);

  const [workedProblemFilter, setWorkedProblemFilter] = useState<MasteredFilter>('all');
  const [masteredProblemIds, setMasteredProblemIds] = useState<Set<string>>(new Set());
  const [togglingProblemId, setTogglingProblemId] = useState<string | null>(null);

  const artifactBuckets = useMemo(() => {
    const matchesSource = (documentId?: string | null, videoId?: string | null) => {
      if (artifactFilter !== 'current' || !selected) return true;
      return selected.kind === 'doc'
        ? documentId === selected.data.id
        : videoId === selected.data.id;
    };
    return {
      notes: artifacts.notes.filter(n => matchesSource(n.documentId, n.videoId)),
      flashcards: artifacts.flashcards.filter(f => matchesSource(f.documentId, f.videoId)),
      questions: artifacts.questions.filter(q => matchesSource(q.documentId, q.videoId)),
      glossary: artifacts.glossary.filter(g => matchesSource(g.documentId, g.videoId)),
      workedProblems: artifacts.workedProblems.filter(p => matchesSource(p.documentId, p.videoId)),
    };
  }, [artifacts, artifactFilter, selected]);

  // Reset difficulty overrides when artifacts reload (course/filter change)
  useEffect(() => {
    setFlashcardDifficultyOverrides(new Map());
  }, [artifacts.flashcards]);

  // Load quiz submissions to power the mistake filter
  useEffect(() => {
    quizSubmissionService.getAllSubmissions(1, 200)
      .then(p => setQuizSubmissions(p.items))
      .catch(() => { });
  }, []);

  const failedQuestionIds = useMemo<Set<string>>(() => {
    const byId = new Map(artifactBuckets.questions.map(q => [q.quizId, q]));
    const everCorrect = new Set<string>();
    const everWrong = new Set<string>();
    for (const submission of quizSubmissions) {
      for (const [quizId, selectedAnswer] of Object.entries(submission.answers ?? {})) {
        if (!byId.has(quizId)) continue;
        const question = byId.get(quizId)!;
        if (selectedAnswer && isQuizOptionCorrect(selectedAnswer, question.correctAnswer)) {
          everCorrect.add(quizId);
        } else {
          everWrong.add(quizId);
        }
      }
    }
    for (const id of everCorrect) everWrong.delete(id);
    return everWrong;
  }, [artifactBuckets.questions, quizSubmissions]);

  // Maps quizId → the last wrong answer the user selected (for the eye button reveal)
  const userAnswerMap = useMemo<Map<string, string>>(() => {
    const byId = new Map(artifactBuckets.questions.map(q => [q.quizId, q]));
    const wrong = new Map<string, string>();
    for (const submission of quizSubmissions) {
      for (const [quizId, selectedAnswer] of Object.entries(submission.answers ?? {})) {
        if (!byId.has(quizId) || !selectedAnswer) continue;
        const question = byId.get(quizId)!;
        if (!isQuizOptionCorrect(selectedAnswer, question.correctAnswer)) {
          wrong.set(quizId, selectedAnswer);
        }
      }
    }
    return wrong;
  }, [artifactBuckets.questions, quizSubmissions]);

  const filteredFlashcards = useMemo(() => {
    const withOverrides = artifactBuckets.flashcards.map(c => {
      const override = flashcardDifficultyOverrides.get(c.id);
      return override ? { ...c, difficulty: override } : c;
    });
    if (flashcardDifficultyFilter === 'all') return withOverrides;
    return withOverrides.filter(c => c.difficulty === flashcardDifficultyFilter);
  }, [artifactBuckets.flashcards, flashcardDifficultyFilter, flashcardDifficultyOverrides]);

  const filteredQuestions = useMemo(() => {
    if (questionFilter === 'all') return artifactBuckets.questions;
    return artifactBuckets.questions.filter(q => failedQuestionIds.has(q.quizId));
  }, [artifactBuckets.questions, questionFilter, failedQuestionIds]);

  // Load mastered IDs from server for unmastered filter
  useEffect(() => {
    masteredService.loadFromServer(userId)
      .then(ids => setMasteredIds(ids))
      .catch(() => { });
  }, [userId]);

  // Load mastered worked problem IDs
  useEffect(() => {
    workedProblemsService.getMastered()
      .then(ids => setMasteredProblemIds(ids))
      .catch(() => { });
  }, [userId]);

  const filteredGlossary = useMemo(() => {
    if (glossaryFilter === 'all') return artifactBuckets.glossary;
    return artifactBuckets.glossary.filter(t => !masteredIds.has(t.id));
  }, [artifactBuckets.glossary, glossaryFilter, masteredIds]);

  const filteredWorkedProblems = useMemo(() => {
    if (workedProblemFilter === 'all') return artifactBuckets.workedProblems;
    return artifactBuckets.workedProblems.filter(p => !masteredProblemIds.has(p.workedProblemId));
  }, [artifactBuckets.workedProblems, workedProblemFilter, masteredProblemIds]);

  const handleFlashcardRate = useCallback((cardId: string, rating: SessionRating) => {
    const newDifficulty: Flashcard['difficulty'] = rating === 4 ? 'easy' : rating === 3 ? 'medium' : 'hard';
    setFlashcardDifficultyOverrides(prev => new Map(prev).set(cardId, newDifficulty));
  }, []);

  const handleToggleMastered = useCallback(async (termId: string) => {
    if (togglingGlossaryId) return;
    setTogglingGlossaryId(termId);
    setMasteredIds(prev => {
      const next = new Set(prev);
      next.has(termId) ? next.delete(termId) : next.add(termId);
      masteredService.updateCache(userId, next);
      return next;
    });
    try {
      await masteredService.toggle(userId, termId);
    } catch {
      // revert optimistic update
      setMasteredIds(prev => {
        const next = new Set(prev);
        next.has(termId) ? next.delete(termId) : next.add(termId);
        masteredService.updateCache(userId, next);
        return next;
      });
    } finally {
      setTogglingGlossaryId(null);
    }
  }, [togglingGlossaryId, userId]);

  const handleToggleProblemMastered = useCallback(async (problemId: string) => {
    if (togglingProblemId) return;
    setTogglingProblemId(problemId);
    setMasteredProblemIds(prev => {
      const next = new Set(prev);
      next.has(problemId) ? next.delete(problemId) : next.add(problemId);
      return next;
    });
    try {
      await workedProblemsService.toggleMastered(problemId);
    } catch {
      // revert optimistic update
      setMasteredProblemIds(prev => {
        const next = new Set(prev);
        next.has(problemId) ? next.delete(problemId) : next.add(problemId);
        return next;
      });
    } finally {
      setTogglingProblemId(null);
    }
  }, [togglingProblemId]);

  return {
    artifactBuckets,
    failedQuestionIds,
    userAnswerMap,
    filteredFlashcards,
    filteredQuestions,
    filteredGlossary,
    filteredWorkedProblems,
    flashcardDifficultyFilter,
    setFlashcardDifficultyFilter,
    questionFilter,
    setQuestionFilter,
    glossaryFilter,
    setGlossaryFilter,
    workedProblemFilter,
    setWorkedProblemFilter,
    masteredIds,
    togglingGlossaryId,
    handleToggleMastered,
    masteredProblemIds,
    togglingProblemId,
    handleToggleProblemMastered,
    handleFlashcardRate,
  };
}

export type ArtifactFilters = ReturnType<typeof useArtifactFilters>;
