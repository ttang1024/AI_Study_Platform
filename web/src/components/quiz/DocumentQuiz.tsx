import React, { useState, useEffect } from 'react';
import { BookOpenCheck, CheckCircle2, XCircle, Loader2, Award, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { QuizQuestion } from '../../types';
import { documentService } from '../../services/documentService';
import { adaptiveQuizService } from '../../services/adaptiveQuizService';
import { useStudy } from '../../context/StudyContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { isQuizOptionCorrect } from '../../utils/quizAnswers';
import { getApiErrorCode } from '../../utils/apiError';
import { EmptyGenerationState, GenerationFailedState } from '../common/GenerationStates';
import { usePrompt } from '../common/PromptBox';

type QuizDifficulty = 'easy' | 'medium' | 'hard';

const QUIZ_DIFFICULTIES: Array<{ value: QuizDifficulty; label: string; detail: string }> = [
  { value: 'easy', label: 'Beginner', detail: 'Recall + Understanding' },
  { value: 'medium', label: 'Intermediate', detail: 'Understanding + Application' },
  { value: 'hard', label: 'Advanced', detail: 'Application + Analysis' },
];

interface DocumentQuizProps {
  /** Initial difficulty tab to show */
  initialDifficulty?: QuizDifficulty;
  /** Controlled difficulty tab, used by external quiz owners */
  activeDifficulty?: QuizDifficulty;
  /** Question to reveal by selecting the difficulty tab that contains it */
  targetQuestionId?: string;
  /** External questions (bypasses StudyContext/API when set) */
  externalQuestions?: QuizQuestion[];
  /** External question counts by difficulty */
  externalQuestionCounts?: Partial<Record<QuizDifficulty, number>>;
  /** External user answers */
  externalUserAnswers?: Record<string, string>;
  /** External submitted state */
  externalSubmitted?: boolean;
  /** External score */
  externalScore?: number;
  /** External loading state */
  isExternalLoading?: boolean;
  /** External error message */
  externalError?: string | null;
  /** External generate handler */
  onExternalGenerate?: (difficulty: QuizDifficulty) => void;
  /** External difficulty switch handler */
  onExternalDifficultyChange?: (difficulty: QuizDifficulty) => void;
  /** External answer handler */
  onExternalAnswer?: (questionId: string, option: string) => void;
  /** External submit handler */
  onExternalSubmit?: () => void;
  generateDisabled?: boolean;
  generateDisabledReason?: string;
}

export const DocumentQuiz: React.FC<DocumentQuizProps> = ({
  initialDifficulty = 'medium',
  activeDifficulty: externalActiveDifficulty,
  targetQuestionId,
  externalQuestions,
  externalQuestionCounts,
  externalUserAnswers,
  externalSubmitted,
  externalScore,
  isExternalLoading,
  externalError,
  onExternalGenerate,
  onExternalDifficultyChange,
  onExternalAnswer,
  onExternalSubmit,
  generateDisabled = false,
  generateDisabledReason,
}) => {
  const { currentDocument } = useStudy();
  const { user } = useAuth();
  const { showPrompt } = usePrompt();
  const isExternal = onExternalGenerate !== undefined;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [activeDifficulty, setActiveDifficulty] = useState<QuizDifficulty>(initialDifficulty);
  const [questionSets, setQuestionSets] = useState<Record<QuizDifficulty, QuizQuestion[]>>({ easy: [], medium: [], hard: [] });
  const [answerSets, setAnswerSets] = useState<Record<QuizDifficulty, Record<string, string>>>({ easy: {}, medium: {}, hard: {} });
  const [submittedSets, setSubmittedSets] = useState<Record<QuizDifficulty, boolean>>({ easy: false, medium: false, hard: false });
  const [scoreSets, setScoreSets] = useState<Record<QuizDifficulty, number>>({ easy: 0, medium: 0, hard: 0 });
  const [errorSets, setErrorSets] = useState<Record<QuizDifficulty, string | null>>({ easy: null, medium: null, hard: null });
  const [isLoading, setIsLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  // Load previously generated quiz and any saved submission when the document opens (internal mode only)
  useEffect(() => {
    if (isExternal || !currentDocument?.courseId) return;
    const { courseId, id: docId } = currentDocument;
    setQuestions([]);
    setQuestionSets({ easy: [], medium: [], hard: [] });
    setAnswerSets({ easy: {}, medium: {}, hard: {} });
    setSubmittedSets({ easy: false, medium: false, hard: false });
    setScoreSets({ easy: 0, medium: 0, hard: 0 });
    setErrorSets({ easy: null, medium: null, hard: null });
    setUserAnswers({});
    setIsSubmitted(false);
    setScore(0);
    setLocalError(null);
    setIsLoading(true);

    Promise.all([
      documentService.getQuiz(courseId, docId),
      documentService.getQuizSubmission(courseId, docId),
    ])
      .then(([qs, submission]) => {
        const grouped: Record<QuizDifficulty, QuizQuestion[]> = { easy: [], medium: [], hard: [] };
        qs.forEach(q => grouped[(q.difficulty ?? 'medium') as QuizDifficulty].push(q));
        const targetDifficulty = targetQuestionId
          ? QUIZ_DIFFICULTIES.find(d => grouped[d.value].some(q => q.id === targetQuestionId))?.value
          : undefined;
        const loadedDifficulty = targetDifficulty
          ?? (grouped[activeDifficulty].length > 0
            ? activeDifficulty
            : QUIZ_DIFFICULTIES.find(d => grouped[d.value].length > 0)?.value ?? activeDifficulty);
        setQuestionSets(grouped);
        if (qs.length > 0) {
          setActiveDifficulty(loadedDifficulty);
          setQuestions(grouped[loadedDifficulty]);
        }
        if (submission) {
          setUserAnswers(submission.answers);
          setAnswerSets(prev => ({ ...prev, [loadedDifficulty]: submission.answers }));
          setIsSubmitted(true);
          setSubmittedSets(prev => ({ ...prev, [loadedDifficulty]: true }));
          setScore(submission.score);
          setScoreSets(prev => ({ ...prev, [loadedDifficulty]: submission.score }));
        }
      })
      .catch(() => { })
      .finally(() => setIsLoading(false));
  }, [currentDocument?.id, isExternal, targetQuestionId]);

  const selectedDifficulty = externalActiveDifficulty ?? activeDifficulty;

  const generateQuiz = async (difficulty: QuizDifficulty = selectedDifficulty) => {
    if (generateDisabled) return;
    setActiveDifficulty(difficulty);
    if (isExternal) {
      onExternalGenerate!(difficulty);
      return;
    }
    if (!currentDocument) return;
    setIsLoading(true);
    setQuestions([]);
    setQuestionSets(prev => ({ ...prev, [difficulty]: [] }));
    setScore(0);
    setScoreSets(prev => ({ ...prev, [difficulty]: 0 }));
    setIsSubmitted(false);
    setSubmittedSets(prev => ({ ...prev, [difficulty]: false }));
    setUserAnswers({});
    setAnswerSets(prev => ({ ...prev, [difficulty]: {} }));
    setLocalError(null);
    setErrorSets(prev => ({ ...prev, [difficulty]: null }));

    try {
      const data = await documentService.generateQuiz(
        currentDocument.courseId || '',
        currentDocument.id,
        difficulty,
      );
      setQuestions(data);
      setQuestionSets(prev => ({ ...prev, [difficulty]: data }));
    } catch (error) {
      console.error('Quiz generation error:', error);
      setLocalError(getApiErrorCode(error));
      setErrorSets(prev => ({ ...prev, [difficulty]: getApiErrorCode(error) }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDifficultyChange = (difficulty: QuizDifficulty) => {
    setActiveDifficulty(difficulty);
    if (isExternal) {
      onExternalDifficultyChange?.(difficulty);
      return;
    }
    setQuestions(questionSets[difficulty]);
    setUserAnswers(answerSets[difficulty]);
    setIsSubmitted(submittedSets[difficulty]);
    setScore(scoreSets[difficulty]);
    setLocalError(errorSets[difficulty]);
  };

  const handleAnswer = (questionId: string, option: string) => {
    if (isExternal) {
      onExternalAnswer?.(questionId, option);
      return;
    }
    if (isSubmitted) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: option }));
    setAnswerSets(prev => ({
      ...prev,
      [activeDifficulty]: { ...prev[activeDifficulty], [questionId]: option },
    }));
  };

  const handleSubmit = async () => {
    if (isExternal) {
      onExternalSubmit?.();
      return;
    }
    if (Object.keys(userAnswers).length < questions.length) {
      showPrompt('Please answer all questions before submitting.');
      return;
    }

    let finalScore = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] && isQuizOptionCorrect(userAnswers[q.id], q.answer)) {
        finalScore++;
      }
    });

    setScore(finalScore);
    setScoreSets(prev => ({ ...prev, [activeDifficulty]: finalScore }));
    setIsSubmitted(true);
    setSubmittedSets(prev => ({ ...prev, [activeDifficulty]: true }));

    // Record result for topic analysis
    adaptiveQuizService.recordResult(user?.id ?? 'guest', currentDocument?.id ?? '', finalScore, questions.length);

    // Persist to database
    if (currentDocument?.courseId) {
      try {
        await documentService.saveQuizSubmission(
          currentDocument.courseId,
          currentDocument.id,
          userAnswers,
          finalScore,
          questions.length,
        );
      } catch (error) {
        console.error('Failed to save quiz submission:', error);
      }
    }
  };

  // Resolve active values (external or internal)
  const activeQuestions = isExternal ? (externalQuestions ?? []) : questionSets[selectedDifficulty];
  const activeAnswers = isExternal ? (externalUserAnswers ?? {}) : answerSets[selectedDifficulty];
  const activeSubmitted = isExternal ? (externalSubmitted ?? false) : submittedSets[selectedDifficulty];
  const activeScore = isExternal ? (externalScore ?? 0) : scoreSets[selectedDifficulty];
  const activeLoading = isExternal ? (isExternalLoading ?? false) : isLoading;
  const activeError = isExternal ? externalError : errorSets[selectedDifficulty];

  const difficultyTabs = (
    <div className="p-6 pb-0">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {QUIZ_DIFFICULTIES.map(difficulty => {
          const isActive = difficulty.value === selectedDifficulty;
          const count = isExternal
            ? externalQuestionCounts?.[difficulty.value] ?? (difficulty.value === selectedDifficulty ? externalQuestions?.length ?? 0 : 0)
            : questionSets[difficulty.value].length;
          return (
            <button
              key={difficulty.value}
              type="button"
              onClick={() => handleDifficultyChange(difficulty.value)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] text-text-main hover:border-[var(--primary)]/40'
              )}
            >
              <span className="block text-sm font-bold">{difficulty.label}</span>
              <span className="block text-[11px] text-text-muted">{count > 0 ? `${count} questions` : difficulty.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (activeLoading) {
    return (
      <div>
        {difficultyTabs}
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
          <p className="mt-4 text-sm text-text-muted">Analyzing and crafting questions...</p>
        </div>
      </div>
    );
  }

  if (activeError && activeQuestions.length === 0) {
    return (
      <div>
        {difficultyTabs}
        <GenerationFailedState message={activeError} onRetry={() => generateQuiz(selectedDifficulty)} retryDisabled={generateDisabled} disabledReason={generateDisabledReason} />
      </div>
    );
  }

  if (activeQuestions.length === 0) {
    return (
      <div>
        {difficultyTabs}
        <EmptyGenerationState
          icon={BookOpenCheck}
          title="No Quiz Yet"
          description={`Ready to test at ${QUIZ_DIFFICULTIES.find(d => d.value === selectedDifficulty)?.label} level?`}
          actionLabel="Generate Quiz"
          onAction={() => generateQuiz(selectedDifficulty)}
          actionDisabled={generateDisabled}
          disabledReason={generateDisabledReason}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {difficultyTabs}
      <div className="px-6 space-y-8">
      {activeSubmitted && (
        <div className="rounded-2xl bg-[var(--primary)]/10 p-6 text-center space-y-3 border border-[var(--primary)]/20">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-white">
            <Award size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-main">Quiz Results</h3>
            <p className="text-sm text-text-muted">
              You scored <span className="font-bold text-[var(--primary)]">{activeScore}</span> out of <span className="font-bold">{activeQuestions.length}</span>
            </p>
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <Button onClick={() => generateQuiz(selectedDifficulty)} variant="secondary" size="sm" disabled={generateDisabled} title={generateDisabled ? generateDisabledReason : undefined}>
              <RotateCcw size={14} className="mr-2" />
              Retake Quiz
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-10">
        {activeQuestions.map((q, idx) => (
          <div key={q.id} className="space-y-4">
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-app)] border border-[var(--border-color)] text-[10px] font-bold text-text-muted">
                {idx + 1}
              </span>
              <h4 className="text-sm font-bold text-text-main leading-relaxed">
                {q.question}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-2 pl-9">
              {q.options?.map((option) => {
                const isSelected = activeAnswers[q.id] === option;
                const isCorrect = isQuizOptionCorrect(option, q.answer);
                const showResult = activeSubmitted;

                return (
                  <button
                    key={option}
                    disabled={activeSubmitted}
                    onClick={() => handleAnswer(q.id, option)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-xl border p-3 text-left text-xs transition-all",
                      !showResult && isSelected && "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]",
                      !showResult && !isSelected && "border-[var(--border-color)] hover:border-[var(--primary)]/30 hover:bg-[var(--bg-app)] text-text-main",
                      showResult && isCorrect && "border-emerald-500 bg-emerald-50 text-emerald-900",
                      showResult && isSelected && !isCorrect && "border-red-500 bg-red-50 text-red-900",
                      showResult && !isSelected && !isCorrect && "border-[var(--border-color)] opacity-50 text-text-muted"
                    )}
                  >
                    <span>{option}</span>
                    {showResult && isCorrect && <CheckCircle2 size={14} className="text-emerald-600" />}
                    {showResult && isSelected && !isCorrect && <XCircle size={14} className="text-red-600" />}
                  </button>
                );
              })}
            </div>

            {activeSubmitted && (
              <div className="ml-9 p-4 rounded-xl bg-zinc-100/50 border border-zinc-200/50 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-text-main uppercase tracking-wider">
                  <AlertCircle size={12} className="text-[var(--primary)]" />
                  Analysis
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed italic">
                  {q.explanation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {!activeSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--bg-sidebar)]/80 backdrop-blur-md border-t border-[var(--border-color)] lg:relative lg:bg-transparent lg:border-none lg:p-0 lg:mt-8">
          <Button
            onClick={handleSubmit}
            className="w-full shadow-lg shadow-[var(--primary)]/20"
            disabled={Object.keys(activeAnswers).length < activeQuestions.length}
          >
            Submit All Answers
          </Button>
        </div>
      )}
      </div>
    </div>
  );
};
